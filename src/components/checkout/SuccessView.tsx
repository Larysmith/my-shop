"use client";

import Link from "next/link";
import { useDemo } from "@/components/demo/DemoProvider";
import { formatPrice } from "@/lib/pricing";
import type { OrderStatus } from "@/lib/demo/types";

const STATUS_COPY: Record<OrderStatus, { label: string; blurb: string }> = {
  pending_payment: {
    label: "Awaiting payment",
    blurb: "Your order is reserved while payment clears.",
  },
  paid: {
    label: "Payment received",
    blurb: "We are getting your parcel ready to ship.",
  },
  shipped: {
    label: "Shipped",
    blurb: "Your parcel is on its way.",
  },
  completed: {
    label: "Delivered",
    blurb: "Delivered. Thanks for shopping with us.",
  },
  canceled: {
    label: "Canceled",
    blurb: "This order was canceled and nothing was charged.",
  },
  refunded: {
    label: "Refunded",
    blurb: "This order was refunded.",
  },
};

export default function SuccessView({ orderNumber }: { orderNumber: string }) {
  const { getOrder, user, hydrated } = useDemo();
  const order = getOrder(orderNumber);

  if (!hydrated) {
    return <p className="text-sm text-foreground/55">Loading your order…</p>;
  }

  if (!order) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">Order not found</h1>
        <p className="mt-2 text-sm text-foreground/60">
          We could not find order {orderNumber || "—"} in this browser.
        </p>
        <Link
          href="/track-order"
          className="mt-5 inline-flex h-10 items-center rounded-full border border-foreground/15 px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
        >
          Track an order
        </Link>
      </div>
    );
  }

  const status = STATUS_COPY[order.status];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4"
          >
            <path d="m4.5 12.5 5 5 10-11" />
          </svg>
          Thank you — your order is confirmed
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          {status.label}
        </h1>
        <p className="mt-1.5 text-sm text-foreground/65">{status.blurb}</p>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-foreground/45">
              Order number
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
              {order.orderNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-foreground/45">Email</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">{order.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-foreground/45">Total</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {formatPrice(order.totalAmount)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 text-foreground/70">
                  <span className="block text-foreground">{item.productName}</span>
                  <span className="text-xs text-foreground/50">
                    {item.variantTitle} · × {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {formatPrice(item.lineTotalAmount)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-foreground/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-foreground/60">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(order.subtotalAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/60">Shipping</dt>
              <dd className="tabular-nums">
                {order.shippingAmount === 0 ? "Free" : formatPrice(order.shippingAmount)}
              </dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(order.totalAmount)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">Shipping to</h2>
          <address className="mt-3 text-sm not-italic leading-6 text-foreground/70">
            {order.shipping.name}
            <br />
            {order.shipping.line1}
            {order.shipping.line2 && (
              <>
                <br />
                {order.shipping.line2}
              </>
            )}
            <br />
            {order.shipping.city}
            {order.shipping.region && `, ${order.shipping.region}`} {order.shipping.postalCode}
            <br />
            {order.shipping.country}
          </address>

          <div className="mt-5 border-t border-foreground/10 pt-4">
            <h3 className="text-sm font-semibold text-foreground">Need it again?</h3>
            <p className="mt-1.5 text-xs leading-5 text-foreground/55">
              Sign in and this order links to your account automatically — no re-typing the
              order number.
            </p>
            {user ? (
              <Link
                href="/account"
                className="mt-3 inline-flex h-10 items-center rounded-full border border-foreground/15 px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
              >
                View your orders
              </Link>
            ) : (
              <Link
                href={`/login?redirectTo=/account`}
                className="mt-3 inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Sign in
              </Link>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-foreground/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Timeline</h2>
        <ol className="mt-4 space-y-3">
          {order.events.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="flex gap-3 text-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground/30"
              />
              <span>
                <span className="font-medium text-foreground">
                  {STATUS_COPY[event.toStatus].label}
                </span>
                <span className="ml-2 text-xs text-foreground/50">
                  {new Date(event.createdAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="block text-xs text-foreground/40">{event.actor}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/products"
          className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Continue shopping
        </Link>
        <Link
          href={`/track-order?order=${order.orderNumber}`}
          className="inline-flex h-11 items-center rounded-full border border-foreground/15 px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
        >
          Track this order
        </Link>
      </div>
    </div>
  );
}
