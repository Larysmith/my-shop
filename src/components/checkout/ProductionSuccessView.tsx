import Link from "next/link";
import { formatPrice } from "@/lib/pricing";
import type { Order } from "@/lib/server/orders/read";

/**
 * Post-payment confirmation.
 *
 * Server-rendered from the order the signed token authorised. Note the wording
 * throughout: the browser is redirected back from Paystack immediately, while the
 * webhook that actually fulfils the order may not have arrived yet. Claiming
 * "payment received" here would be a promise the server has not verified, so the
 * status shown is whatever the database says at render time.
 */
export default function ProductionSuccessView({ order }: { order: Order }) {
  const paid = order.status !== "pending_payment";

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
          Thank you — we have your order
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          {paid ? "Payment received" : "Confirming your payment"}
        </h1>
        <p className="mt-1.5 text-sm text-foreground/65">
          {paid
            ? "We are getting your parcel ready to ship."
            : "This page updates once Paystack confirms the charge. You can close it — a receipt is on its way by email."}
        </p>

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
              {formatPrice(order.totalAmount, order.currency)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((item, index) => (
              <li
                key={`${item.variantId ?? item.productName}-${index}`}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="min-w-0 text-foreground/70">
                  <span className="block text-foreground">{item.productName}</span>
                  <span className="text-xs text-foreground/50">
                    {item.variantTitle} · × {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {formatPrice(item.lineTotalAmount, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-foreground/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-foreground/60">Subtotal</dt>
              <dd className="tabular-nums">
                {formatPrice(order.subtotalAmount, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/60">Shipping</dt>
              <dd className="tabular-nums">
                {order.shippingAmount === 0
                  ? "Free"
                  : formatPrice(order.shippingAmount, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {formatPrice(order.totalAmount, order.currency)}
              </dd>
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
            {order.shipping.region && `, ${order.shipping.region}`}{" "}
            {order.shipping.postalCode}
            <br />
            {order.shipping.country}
          </address>

          <div className="mt-5 border-t border-foreground/10 pt-4">
            <h3 className="text-sm font-semibold text-foreground">Track it</h3>
            <p className="mt-1.5 text-xs leading-5 text-foreground/55">
              Your order number and the email above are all you need — no account required.
            </p>
            <Link
              href={`/track-order?order=${order.orderNumber}`}
              className="mt-3 inline-flex h-10 items-center rounded-full border border-foreground/15 px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
            >
              Track this order
            </Link>
          </div>
        </section>
      </div>

      {order.events.length > 0 && (
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
                  <span className="font-medium capitalize text-foreground">
                    {event.toStatus.replace(/_/g, " ")}
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
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/products"
          className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}