"use client";

import { useState } from "react";
import OrderStatusBadge from "@/components/order/OrderStatusBadge";
import { formatPrice } from "@/lib/pricing";
import type { TrackedOrder } from "@/components/order/track-types";

/**
 * The tracking form's markup, with the lookup supplied as a prop.
 *
 * Split out because the lookup has two very different sources: the demo store in
 * `localStorage`, or a Server Action that queries Postgres. Passing the lookup in
 * keeps one copy of the form and lets the caller choose the source, which is what
 * keeps `useDemo()` out of the production component entirely.
 */

const INPUT =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none";

export default function TrackOrderFields({
  initialOrderNumber,
  lookup,
  showDemoHints,
}: {
  initialOrderNumber: string;
  /** Resolves to null when nothing matches. */
  lookup: (orderNumber: string, email: string) => Promise<TrackedOrder | null>;
  showDemoHints: boolean;
}) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<TrackedOrder | null>(null);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);

    try {
      setResult(await lookup(orderNumber, email));
      setSearched(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label
            htmlFor="track-order-number"
            className="block text-sm font-medium text-foreground"
          >
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
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Looking…" : "Find my order"}
        </button>
      </form>

      {searched && !result && (
        <div className="mt-8 rounded-2xl border border-dashed border-foreground/15 p-6">
          <p className="text-sm font-medium text-foreground">No matching order</p>
          {/* Deliberately the same message whether the order number is wrong or the
              email is: telling the two apart would confirm that an order number
              exists to anyone who can guess the format. */}
          <p className="mt-1.5 text-sm text-foreground/60">
            Check the order number and the email address. Both must match the order exactly.
          </p>
          {showDemoHints && (
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
          )}
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
                {formatPrice(result.totalAmount, result.currency)}
              </p>
            </div>
          </header>

          <ul className="mt-4 space-y-2.5 border-t border-foreground/10 pt-4">
            {result.items.map((item, index) => (
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
                  {formatPrice(item.lineTotalAmount, result.currency)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-foreground/50">
            Shipping to {result.shipping.name}, {result.shipping.city}
          </p>
        </article>
      )}
    </div>
  );
}
