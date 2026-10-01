"use server";

import { lookupGuestOrder, type Order } from "@/lib/server/orders/read";
import { DEMO_MODE } from "@/lib/demo/types";

/**
 * Guest order lookup.
 *
 * Returns the same shape in both modes so the tracking page renders identically.
 * Nothing is returned unless the order number *and* the email match, which is the
 * only credential a guest has — so a wrong guess reveals nothing, not even
 * whether the order number exists.
 *
 * The message for "no match" is deliberately identical to "not found": telling a
 * caller that an order number exists but the email was wrong would leak the
 * number space to anyone who can guess the format.
 */
export type TrackResult =
  | { ok: true; order: TrackOrder }
  | { ok: false };

/** A trimmed projection, so the action returns only what the page renders. */
export type TrackOrder = Pick<
  Order,
  | "orderNumber"
  | "status"
  | "totalAmount"
  | "currency"
  | "createdAt"
  | "items"
  | "shipping"
>;

export async function trackOrder(input: {
  orderNumber: string;
  email: string;
}): Promise<TrackResult> {
  const orderNumber = input.orderNumber.trim();
  const email = input.email.trim();

  if (!orderNumber || !email) return { ok: false };
  if (DEMO_MODE) return { ok: false };

  const order = await lookupGuestOrder(orderNumber, email);
  if (!order) return { ok: false };

  return {
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      items: order.items,
      shipping: order.shipping,
    },
  };
}