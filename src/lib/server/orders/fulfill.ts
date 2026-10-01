import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/server/email/send";

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
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
  line_total_cents: number;
};

export type OrderIdempotencyEvent =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed";

export type FulfillResult = {
  status: "fulfilled" | "already_applied" | "not_found";
  orderNumber: string | null;
};

/**
 * Marks a paid order, releases stock, and fires the customer and owner emails.
 *
 * Stripe retries webhooks and delivers them at least once, so this must be
 * safe to run twice. The unique index on `orders.stripe_event_id` is the real
 * guard: the status flip and the event id land in one update, so a concurrent
 * or repeated delivery loses the race and is reported as already applied rather
 * than decrementing stock a second time.
 */
export async function fulfillPaidOrder(input: {
  eventId: string;
  sessionId: string;
  orderNumber: string;
  event: OrderIdempotencyEvent;
}): Promise<FulfillResult> {
  const { eventId, sessionId, orderNumber, event } = input;
  const supabase = createAdminClient();

  const { data: existing, error: lookupError } = await supabase
    .from("orders")
    .select("id, order_number, status, stripe_event_id")
    .or(`stripe_checkout_session_id.eq.${sessionId},order_number.eq.${orderNumber}`)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Order lookup failed: ${lookupError.message}`);
  }

  if (!existing) {
    return { status: "not_found", orderNumber: null };
  }

  const order = existing as { id: string; order_number: string; status: string };

  if (order.status === "paid" || order.status === "shipped" || order.status === "completed") {
    return { status: "already_applied", orderNumber: order.order_number };
  }

  if (event === "checkout.session.async_payment_failed") {
    // Stock is not released here on purpose. The variant rows stay untouched
    // until an explicit refund or cancellation decision is made.
    return { status: "already_applied", orderNumber: order.order_number };
  }

  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: sessionId,
      stripe_event_id: eventId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .is("stripe_event_id", null)
    .select("id");

  if (claimError) {
    throw new Error(`Could not mark order paid: ${claimError.message}`);
  }

  // No row came back means a concurrent delivery already claimed this order.
  if (!claimed || claimed.length === 0) {
    return { status: "already_applied", orderNumber: order.order_number };
  }

  await recordEvent({
    supabase,
    orderId: order.id,
    from: "pending_payment",
    to: "paid",
    actor: "stripe",
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
 * Rebuilds the line list from stored order_items, never from the event payload.
 * The event carries Stripe's view of the cart; `order_items` is what this shop
 * priced and recorded at checkout time.
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
      "id, order_number, email, status, subtotal_cents, shipping_cents, total_cents, currency, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, shipping_postal_code, shipping_country, user_id, order_items (product_name, variant_title, sku, quantity, line_total_cents)",
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
    totalCents: row.total_cents,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
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
      lineTotalCents: item.line_total_cents,
    })),
  };

  await sendOrderEmail({ orderId, template: "order_confirmation", order });
  await sendOrderEmail({ orderId, template: "owner_new_order", order });
}