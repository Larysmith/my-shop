import Link from "next/link";
import OrderStatusBadge from "@/components/order/OrderStatusBadge";
import { formatPrice } from "@/lib/pricing";
import type { Order } from "@/lib/server/orders/read";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  shipped: "Shipped",
  completed: "Completed",
  canceled: "Canceled",
  refunded: "Refunded",
};

function label(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

/**
 * Order detail, server-rendered from an order the caller was already authorised
 * to see. Purely presentational: the demo variant owns status changes and the
 * email log, neither of which exists on this path.
 */
export default function OrderDetailView({ order }: { order: Order }) {
  const currency = order.currency;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-semibold text-foreground">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-foreground/55">
            {order.email} ·{" "}
            {new Date(order.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
          </p>
        </div>
        <div className="text-right">
          <OrderStatusBadge status={order.status} />
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-foreground">
            {formatPrice(order.totalAmount, currency)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((item, index) => (
              <li
                key={`${item.variantId ?? item.productName}-${index}`}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  {item.productId ? (
                    <Link
                      href={`/products/${item.productId}`}
                      className="block text-foreground hover:underline"
                    >
                      {item.productName}
                    </Link>
                  ) : (
                    <span className="block text-foreground">{item.productName}</span>
                  )}
                  <span className="text-xs text-foreground/50">
                    {item.variantTitle} · {item.sku} · × {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {formatPrice(item.lineTotalAmount, currency)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-foreground/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-foreground/60">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(order.subtotalAmount, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/60">Shipping</dt>
              <dd className="tabular-nums">
                {order.shippingAmount === 0
                  ? "Free"
                  : formatPrice(order.shippingAmount, currency)}
              </dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(order.totalAmount, currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">Ship to</h2>
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
          {order.customerNotes && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-foreground">Notes</h3>
              <p className="mt-1.5 text-sm text-foreground/65">{order.customerNotes}</p>
            </>
          )}
          {order.paidAt && (
            <p className="mt-4 text-xs text-foreground/45">
              Paid{" "}
              {new Date(order.paidAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-foreground/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Timeline</h2>
        {order.events.length === 0 ? (
          <p className="mt-3 text-sm text-foreground/55">No status changes recorded yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {order.events.map((event, index) => (
              <li key={`${event.createdAt}-${index}`} className="flex gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground/30"
                />
                <span>
                  <span className="font-medium text-foreground">
                    {label(event.toStatus)}
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
        )}
      </section>
    </div>
  );
}