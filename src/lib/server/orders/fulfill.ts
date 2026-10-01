import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/server/email/send";

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  subtotal_amount: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_region: string | null;
  shipping_postal_code: string | null;
  shipping_country: string;
  user_id: string | null;
};

type OrderItemRow = {
  product_name: string;
  variant_title: string;
  sku: string;
  quantity: number;
  line_total_amount: number;
};

export type FulfillResult = {
  status: "fulfilled" | "already_applied" | "not_found" | "payment_failed";
  orderNumber: string | null;
};

/**
 * Marks a paid order, releases stock, and fires the customer and owner emails.
 *
 * Paystack retries webhooks and may deliver the same event more than once, so
 * this must be safe to run twice. The unique index on `orders.paystack_reference`
 * is the real guard: the status flip and the reference land in one update, so a
 * repeated or concurrent delivery loses the race and is reported as already
 * applied rather than decrementing stock a second time.
 *
 * `amount` is what Paystack says it charged. It is compared against the stored
 * total before anything is fulfilled, because a mismatch means the customer paid
 * a different amount than this shop recorded — crediting that order would ship
 * goods for the wrong money.
 */
export async function fulfillPaidOrder(input: {
  reference: string;
  /**
   * Optional second key for the lookup. The Paystack webhook only carries the
   * reference, so this stays undefined there; a manual reconciliation call may
   * pass the order number when the reference is unknown.
   */
  orderNumber?: string;
  paid: boolean;
  chargedAmount: number;
}): Promise<FulfillResult> {
  const { reference, orderNumber, paid, chargedAmount } = input;
  const supabase = createAdminClient();

  // PostgREST `.or()` takes a comma-separated filter list, so only the keys we
  // actually have are included. An empty `order_number.eq.` would match nothing
  // and could mask a real reference match.
  const filters = [`paystack_reference.eq.${reference}`];
  if (orderNumber) filters.push(`order_number.eq.${orderNumber}`);

  const { data: existing, error: lookupError } = await supabase
    .from("orders")
    .select("id, order_number, status, total_amount, currency, paystack_reference")
    .or(filters.join(","))
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Order lookup failed: ${lookupError.message}`);
  }

  if (!existing) {
    return { status: "not_found", orderNumber: null };
  }

  const order = existing as {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    currency: string;
    paystack_reference: string | null;
  };

  if (order.status === "paid" || order.status === "shipped" || order.status === "completed") {
    return { status: "already_applied", orderNumber: order.order_number };
  }

  if (!paid) {
    // A failed or abandoned charge leaves the order pending. Stock is not
    // released here on purpose: the variant rows stay untouched until an
    // explicit refund or cancellation decision is made.
    return { status: "payment_failed", orderNumber: order.order_number };
  }

  if (!Number.isInteger(chargedAmount)) {
    // Guards the comparison below. A float would fail equality against an
    // integer total anyway, but the message would be misleading.
    throw new Error(
      `Paystack reported a non-integer charged amount for ${order.order_number}: ${chargedAmount}.`,
    );
  }

  if (order.total_amount !== chargedAmount) {
    throw new Error(
      `Amount mismatch for ${order.order_number}: Paystack charged ${chargedAmount} ` +
        `${order.currency} but the order totals ${order.total_amount}. Refusing to fulfill.`,
    );
  }

  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paystack_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    // The claim condition: no reference has been recorded yet. A repeated
    // delivery matches nothing and is reported as already applied.
    .is("paystack_reference", null)
    .select("id");

  if (claimError) {
    throw new Error(`Could not mark order paid: ${claimError.message}`);
  }

  if (!claimed || claimed.length === 0) {
    return { status: "already_applied", orderNumber: order.order_number };
  }

  await recordEvent({
    supabase,
    orderId: order.id,
    from: "pending_payment",
    to: "paid",
    actor: "paystack",
  });

  await releaseStock(supabase, order.id);
  await sendEmails(order.id);

  return { status: "fulfilled", orderNumber: order.order_number };
}

type SupabaseLike = ReturnType<typeof createAdminClient>;

async function recordEvent(input: {
  supabase: SupabaseLike;
  orderId: string;
  from: string | null;
  to: string;
  actor: string;
}): Promise<void> {
  const { error } = await input.supabase.from("order_events").insert({
    order_id: input.orderId,
    from_status: input.from,
    to_status: input.to,
    actor: input.actor,
  });

  if (error) {
    console.error("order_events insert failed", error.message);
  }
}

/**
 * Rebuilds the line list from stored order_items, never from the webhook body.
 * The event carries Paystack's view of the payment; `order_items` is what this
 * shop priced and recorded at checkout time.
 */
async function releaseStock(
  supabase: SupabaseLike,
  orderId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("order_items")
    .select("variant_id, quantity")
    .eq("order_id", orderId);

  if (error) {
    console.error("order_items read for stock release failed", error.message);
    return;
  }

  const items = (data ?? [])
    .filter((row): row is { variant_id: string; quantity: number } => Boolean(row.variant_id))
    .map((row) => ({ variantId: row.variant_id, quantity: row.quantity }));

  if (items.length === 0) return;

  const { error: rpcError } = await supabase.rpc("decrement_stock", {
    p_items: items,
  });

  if (rpcError) {
    // Do not throw: the payment already succeeded, so a stock shortfall must
    // surface as an operational problem rather than a failed webhook.
    console.error("decrement_stock failed", rpcError.message);
  }
}

async function sendEmails(orderId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, email, status, subtotal_amount, shipping_amount, total_amount, currency, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, shipping_postal_code, shipping_country, user_id, order_items (product_name, variant_title, sku, quantity, line_total_amount)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    console.error("order read for email failed", error?.message ?? "no row");
    return;
  }

  const row = data as unknown as OrderRow & { order_items: OrderItemRow[] };

  const order = {
    orderNumber: row.order_number,
    email: row.email,
    totalAmount: row.total_amount,
    subtotalAmount: row.subtotal_amount,
    shippingAmount: row.shipping_amount,
    currency: row.currency,
    trackingNumber: null,
    shipping: {
      name: row.shipping_name,
      line1: row.shipping_line1,
      line2: row.shipping_line2 ?? undefined,
      city: row.shipping_city,
      region: row.shipping_region ?? undefined,
      postalCode: row.shipping_postal_code ?? undefined,
      country: row.shipping_country,
    },
    items: (row.order_items ?? []).map((item) => ({
      productName: item.product_name,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      lineTotalAmount: item.line_total_amount,
    })),
  };

  await sendOrderEmail({ orderId, template: "order_confirmation", order });
  await sendOrderEmail({ orderId, template: "owner_new_order", order });
}