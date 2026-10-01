"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDemo } from "@/components/demo/DemoProvider";
import { OrderStatusBadge } from "@/components/order/TrackOrderForm";
import { formatPrice } from "@/lib/pricing";

export default function AccountView() {
  const { user, orders, hydrated, signOut } = useDemo();
  const router = useRouter();

  if (!hydrated) {
    return <p className="text-sm text-foreground/55">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">You are not signed in</h2>
        <p className="mt-2 text-sm text-foreground/60">
          Sign in to see the orders linked to your account.
        </p>
        <Link
          href="/login?redirectTo=/account"
          className="mt-5 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // Matches the RLS rule in production: a buyer sees their own orders, and a
  // guest order counts once the email matches, which is what linking does.
  const mine = orders
    .filter((order) => order.userId === user.id || order.email === user.email)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const spent = mine
    .filter((o) => o.status !== "canceled" && o.status !== "refunded")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{user.fullName}</h2>
          <p className="mt-0.5 text-sm text-foreground/55">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            signOut();
            router.push("/");
          }}
          className="inline-flex h-10 items-center rounded-full border border-foreground/15 px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
        >
          Sign out
        </button>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-foreground/10 p-4">
          <dt className="text-xs uppercase tracking-wider text-foreground/45">Orders</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {mine.length}
          </dd>
        </div>
        <div className="rounded-2xl border border-foreground/10 p-4">
          <dt className="text-xs uppercase tracking-wider text-foreground/45">Lifetime spend</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {formatPrice(spent)}
          </dd>
        </div>
        <div className="rounded-2xl border border-foreground/10 p-4">
          <dt className="text-xs uppercase tracking-wider text-foreground/45">Open orders</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {mine.filter((o) => o.status === "paid" || o.status === "shipped").length}
          </dd>
        </div>
      </dl>

      <section>
        <h3 className="text-sm font-semibold text-foreground">Order history</h3>
        {mine.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-foreground/15 py-10 text-center text-sm text-foreground/60">
            No orders yet.{" "}
            <Link href="/products" className="font-medium text-foreground underline underline-offset-4">
              Start shopping
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {mine.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 p-4 transition-colors hover:border-foreground/25"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-semibold text-foreground">
                      {order.orderNumber}
                    </span>
                    <span className="mt-0.5 block text-xs text-foreground/50">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                      {" · "}
                      {order.items.length}{" "}
                      {order.items.length === 1 ? "item" : "items"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatPrice(order.totalAmount)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
