"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDemo } from "@/components/demo/DemoProvider";
import { formatPrice } from "@/lib/pricing";
import type { DemoOrder, OrderStatus } from "@/lib/demo/types";

const INPUT =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  paid: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  shipped: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-400",
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  canceled: "bg-foreground/8 text-foreground/60",
  refunded: "bg-foreground/8 text-foreground/60",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_STYLE[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default function TrackOrderForm() {
  const searchParams = useSearchParams();
  const { lookupGuestOrder, hydrated } = useDemo();

  const [orderNumber, setOrderNumber] = useState(searchParams.get("order") ?? "");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<DemoOrder | null>(null);
  const [searched, setSearched] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(lookupGuestOrder(orderNumber, email) ?? null);
    setSearched(true);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label htmlFor="track-order-number" className="block text-sm font-medium text-foreground">
            Order number
          </label>
          <input
            id="track-order-number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="LS-4KP2QD"
            className={`mt-1.5 font-mono ${INPUT}`}
            required
          />
        </div>
        <div>
          <label htmlFor="track-email" className="block text-sm font-medium text-foreground">
            Email used at checkout
          </label>
          <input
            id="track-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`mt-1.5 ${INPUT}`}
            required
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Find my order
        </button>
      </form>

      {!hydrated && <p className="mt-6 text-sm text-foreground/55">Loading…</p>}

      {hydrated && searched && !result && (
        <div className="mt-8 rounded-2xl border border-dashed border-foreground/15 p-6">
          <p className="text-sm font-medium text-foreground">No matching order</p>
          <p className="mt-1.5 text-sm text-foreground/60">
            Check the order number and the email address. Both must match the order exactly.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-foreground/45">
            <li>
              Try <span className="font-mono">LS-4KP2QD</span> with{" "}
              <span className="font-mono">nina@example.com</span>
            </li>
            <li>
              Or <span className="font-mono">LS-2VB6JH</span> with{" "}
              <span className="font-mono">guest@example.com</span>
            </li>
          </ul>
        </div>
      )}

      {result && (
        <article className="mt-8 rounded-2xl border border-foreground/10 p-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-semibold text-foreground">
                {result.orderNumber}
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                Placed{" "}
                {new Date(result.createdAt).toLocaleDateString("en-US", {
                  dateStyle: "medium",
                })}
              </p>
            </div>
            <div className="text-right">
              <OrderStatusBadge status={result.status} />
              <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
                {formatPrice(result.totalCents)}
              </p>
            </div>
          </header>

          <ul className="mt-4 space-y-2.5 border-t border-foreground/10 pt-4">
            {result.items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 text-foreground/70">
                  <span className="block text-foreground">{item.productName}</span>
                  <span className="text-xs text-foreground/50">
                    {item.variantTitle} · × {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {formatPrice(item.lineTotalCents)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-foreground/50">
            Shipping to {result.shipping.name}, {result.shipping.city}{" "}
            {result.shipping.postalCode}
          </p>
        </article>
      )}
    </div>
  );
}
