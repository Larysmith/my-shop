"use client";

import Link from "next/link";
import { useDemo } from "@/components/demo/DemoProvider";
import { OrderStatusBadge } from "@/components/order/TrackOrderForm";
import { formatPrice } from "@/lib/pricing";
import { ORDER_STATUSES, type DemoEmail, type EmailTemplate, type OrderStatus } from "@/lib/demo/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  shipped: "Shipped",
  completed: "Completed",
  canceled: "Canceled",
  refunded: "Refunded",
};

function EmailRow({ entry }: { entry: DemoEmail }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/8 py-2.5 last:border-b-0">
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground">{entry.subject}</span>
        <span className="block text-xs text-foreground/50">
          to {entry.toEmail} · {entry.template.replace(/_/g, " ")}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
            entry.status === "sent"
              ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
              : "bg-red-500/12 text-red-700 dark:text-red-400"
          }`}
        >
          {entry.status}
        </span>
        <span className="text-xs tabular-nums text-foreground/40">
          {new Date(entry.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </span>
    </li>
  );
}

export default function OrderDetail({
  orderNumber,
  isAdmin = false,
}: {
  orderNumber: string;
  isAdmin?: boolean;
}) {
  const { getOrder, updateStatus, resendEmail, emails, hydrated, user } = useDemo();
  const order = getOrder(orderNumber);

  if (!hydrated) {
    return <p className="text-sm text-foreground/55">Loading…</p>;
  }

  if (!order) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Order {orderNumber} not found</p>
        <Link
          href={isAdmin ? "/admin/orders" : "/account"}
          className="mt-4 inline-flex h-10 items-center rounded-full border border-foreground/15 px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const orderEmails = emails.filter((e) => e.orderNumber === order.orderNumber);
  const canView = isAdmin || user?.id === order.userId || user?.email === order.email;

  if (!canView) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
        <p className="text-sm font-medium text-foreground">You cannot view this order</p>
        <p className="mt-2 text-sm text-foreground/60">
          It belongs to a different account.{" "}
          <Link href="/track-order" className="underline underline-offset-4">
            Track it with your order number
          </Link>
          .
        </p>
      </div>
    );
  }

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
            {formatPrice(order.totalAmount)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <Link
                    href={`/products/${item.productId}`}
                    className="block text-foreground hover:underline"
                  >
                    {item.productName}
                  </Link>
                  <span className="text-xs text-foreground/50">
                    {item.variantTitle} · {item.sku} · × {item.quantity}
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
        </section>
      </div>

      <section className="rounded-2xl border border-foreground/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Timeline</h2>
        <ol className="mt-4 space-y-3">
          {order.events.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="flex gap-3 text-sm">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground/30" />
              <span>
                <span className="font-medium text-foreground">
                  {STATUS_LABEL[event.toStatus]}
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

      {isAdmin && (
        <section className="rounded-2xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">Fulfillment</h2>
          <p className="mt-1 text-xs text-foreground/50">
            Marking as shipped fires the customer and owner emails, exactly as the webhook path
            will in production.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ORDER_STATUSES.filter((s) => s !== order.status).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => updateStatus(order.orderNumber, status)}
                className="inline-flex h-9 items-center rounded-full border border-foreground/15 px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/35"
              >
                Mark {STATUS_LABEL[status].toLowerCase()}
              </button>
            ))}
          </div>
        </section>
      )}

      {(isAdmin || orderEmails.length > 0) && (
        <section className="rounded-2xl border border-foreground/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Email log
              <span className="ml-2 font-normal text-foreground/45">
                {orderEmails.length} sent
              </span>
            </h2>
            {isAdmin && (
              <div className="flex gap-2">
                {(["order_confirmation", "order_shipped"] as EmailTemplate[]).map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => resendEmail(order.orderNumber, template)}
                    className="inline-flex h-8 items-center rounded-full border border-foreground/15 px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/35"
                  >
                    Resend {template === "order_confirmation" ? "confirmation" : "shipped"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {orderEmails.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/55">No emails logged for this order.</p>
          ) : (
            <ul className="mt-3">
              {orderEmails.map((entry) => (
                <EmailRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
