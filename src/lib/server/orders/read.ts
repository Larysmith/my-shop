import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Order reads for the storefront, account, and admin screens.
 *
 * The shared shape is deliberately the same one the demo store uses, so a view
 * component renders identically in both modes and never branches on where its
 * data came from.
 */

export type OrderItem = {
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantTitle: string;
  sku: string;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
};

export type OrderEvent = {
  fromStatus: string | null;
  toStatus: string;
  actor: string;
  createdAt: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  userId: string | null;
  email: string;
  status: string;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  shipping: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
  };
  items: OrderItem[];
  events: OrderEvent[];
  customerNotes?: string;
  createdAt: string;
  paidAt: string | null;
  trackingNumber: string | null;
};

const ORDER_SELECT = `
  id, order_number, user_id, email, status,
  subtotal_amount, shipping_amount, total_amount, currency,
  shipping_name, shipping_line1, shipping_line2,
  shipping_city, shipping_region, shipping_postal_code, shipping_country,
  customer_notes, created_at, paid_at,
  order_items (
    product_id, variant_id, product_name, variant_title, sku,
    unit_price_amount, quantity, line_total_amount
  )
`;

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string | null;
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
  customer_notes: string | null;
  created_at: string;
  paid_at: string | null;
  order_items: {
    product_id: string | null;
    variant_id: string | null;
    product_name: string;
    variant_title: string;
    sku: string;
    unit_price_amount: number;
    quantity: number;
    line_total_amount: number;
  }[] | null;
};

function toOrder(row: OrderRow, events: OrderEvent[]): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    email: row.email,
    status: row.status,
    subtotalAmount: row.subtotal_amount,
    shippingAmount: row.shipping_amount,
    totalAmount: row.total_amount,
    currency: row.currency,
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
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.product_name,
      variantTitle: item.variant_title,
      sku: item.sku,
      unitPriceAmount: item.unit_price_amount,
      quantity: item.quantity,
      lineTotalAmount: item.line_total_amount,
    })),
    events,
    customerNotes: row.customer_notes ?? undefined,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    // No column for this yet; the shipped email has nothing to show without one.
    trackingNumber: null,
  };
}

/**
 * Event timelines for a set of orders, in one query.
 *
 * `order_events` has no grant to anon or authenticated, so this always uses the
 * service role and is only called after the caller has already been authorised by
 * RLS or by an explicit admin check.
 */
async function eventsFor(orderIds: string[]): Promise<Map<string, OrderEvent[]>> {
  const byOrder = new Map<string, OrderEvent[]>();
  if (orderIds.length === 0) return byOrder;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_events")
    .select("order_id, from_status, to_status, actor, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("order_events read failed:", error.message);
    return byOrder;
  }

  for (const row of data ?? []) {
    const list = byOrder.get(row.order_id) ?? [];
    list.push({
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actor: row.actor,
      createdAt: row.created_at,
    });
    byOrder.set(row.order_id, list);
  }

  return byOrder;
}

/**
 * Orders belonging to the signed-in user.
 *
 * Goes through the RLS-scoped client, not the service role: `orders_read_own`
 * restricts rows to `auth.uid()`, so a mistake in the filter below still cannot
 * return someone else's order. Matching on email as well as user_id picks up
 * guest orders placed before signing in — the same rule the account view used in
 * demo mode.
 */
export async function getOrdersForUser(
  userId: string,
  email: string,
): Promise<Order[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .or(`user_id.eq.${userId},email.ilike.${email}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("account order read failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as OrderRow[];
  const events = await eventsFor(rows.map((row) => row.id));
  return rows.map((row) => toOrder(row, events.get(row.id) ?? []));
}

/** Guest lookup: order number plus the email it was placed with. */
export async function lookupGuestOrder(
  orderNumber: string,
  email: string,
): Promise<Order | null> {
  const supabase = await createClient();

  // The RPC is the intended path and keeps the comparison rules in one place.
  const { data, error } = await supabase.rpc("lookup_guest_order", {
    p_order_number: orderNumber,
    p_email: email,
  });

  if (error) {
    console.error("guest order lookup failed:", error.message);
    return null;
  }

  if (!data) return null;

  // The RPC returns a display payload, not the full row, so re-read for the
  // shipping address and line items the tracking page renders.
  const { data: row } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!row) return null;

  const order = (row as unknown as OrderRow);
  const events = await eventsFor([order.id]);
  return toOrder(order, events.get(order.id) ?? []);
}

/** One order, for the detail page. Returns null if the caller may not see it. */
export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    console.error(`order read failed for ${orderNumber}:`, error.message);
    return null;
  }

  if (!data) return null;

  const row = data as unknown as OrderRow;
  const events = await eventsFor([row.id]);
  return toOrder(row, events.get(row.id) ?? []);
}

/**
 * One order for the post-payment confirmation page.
 *
 * Uses the service role, because a guest buyer has no session and the RLS-scoped
 * client would return nothing for them. That is only safe because the caller must
 * already have verified a signed token from `view-token.ts` — the order number
 * alone is never enough. Do not call this from anywhere that does not.
 */
export async function getOrderForConfirmation(orderNumber: string): Promise<Order | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    console.error(`confirmation read failed for ${orderNumber}:`, error.message);
    return null;
  }

  if (!data) return null;

  const row = data as unknown as OrderRow;
  const events = await eventsFor([row.id]);
  return toOrder(row, events.get(row.id) ?? []);
}

/**
 * One order for the admin detail page. Service role, because an admin may read
 * any order and RLS would refuse. Callers must have re-checked `is_admin` for
 * themselves — the service role cannot enforce that.
 */
export async function getOrderByNumberForAdmin(
  orderNumber: string,
): Promise<Order | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    console.error(`admin order read failed for ${orderNumber}:`, error.message);
    return null;
  }

  if (!data) return null;

  const row = data as unknown as OrderRow;
  const events = await eventsFor([row.id]);
  return toOrder(row, events.get(row.id) ?? []);
}

/** Every order, newest first. Service role: callers must be admins. */
export async function getAllOrders(): Promise<Order[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("admin order read failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as OrderRow[];
  const events = await eventsFor(rows.map((row) => row.id));
  return rows.map((row) => toOrder(row, events.get(row.id) ?? []));
}

export type EmailLogEntry = {
  id: string;
  orderId: string | null;
  template: string;
  toEmail: string;
  providerId: string | null;
  status: string;
  error: string | null;
  createdAt: string;
};

/** The email log, for the admin screen. Service role: callers must be admins. */
export async function getEmailLog(limit = 100): Promise<EmailLogEntry[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_log")
    .select("id, order_id, template, to_email, provider_id, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("email log read failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    template: row.template,
    toEmail: row.to_email,
    providerId: row.provider_id,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  }));
}