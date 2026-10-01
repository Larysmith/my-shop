"use client";

import Link from "next/link";
import { useState } from "react";
import OrderStatusBadge from "@/components/order/OrderStatusBadge";
import { formatPrice } from "@/lib/pricing";

/**
 * Admin order list. Presentational only — the server decides what an admin may
 * see and passes the rows in, so nothing here trusts a client-supplied filter.
 */

type AdminOrder = {
  orderNumber: string;
  email: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
  customerName: string;
};

type AdminEmail = {
  id: string;
  subject: string;
  toEmail: string;
  template: string;
  status: string;
  createdAt: string;
};

const STATUSES = [
  "pending_payment",
  "paid",
  "shipped",
  "completed",
  "canceled",
  "refunded",
] as const;

type Tab = "orders" | "emails";

export default function AdminOrdersTable({
  orders,
  emails,
  onReset,
}: {
  orders: AdminOrder[];
  emails: AdminEmail[];
  onReset?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("orders");
  const [status, setStatus] = useState<string | "all">("all");

  const sorted = [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const visible = status === "all" ? sorted : sorted.filter((o) => o.status === status);

  const counts = STATUSES.map((s) => ({
    status: s,
    count: sorted.filter((o) => o.status === s).length,
  })).filter((row) => row.count > 0);

  const revenue = sorted
    .filter((o) => o.status !== "canceled" && o.status !== "refunded")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-foreground/10 px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-foreground/45">Orders</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{sorted.length}</dd>
          </div>
          <div className="rounded-2xl border border-foreground/10 px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-foreground/45">Revenue</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">
              {formatPrice(revenue)}
            </dd>
          </div>
          <div className="rounded-2xl border border-foreground/10 px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-foreground/45">Emails</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{emails.length}</dd>
          </div>
        </dl>

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center rounded-full border border-foreground/15 px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/35"
          >
            Reset demo data
          </button>
        )}
      </div>

      <div className="mt-8 flex gap-1 border-b border-foreground/10">
        {(["orders", "emails"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            aria-current={tab === item ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === item
                ? "border-foreground text-foreground"
                : "border-transparent text-foreground/50 hover:text-foreground"
            }`}
          >
            {item}
            {item === "emails" && (
              <span className="ml-1.5 text-foreground/40">{emails.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
              All ({sorted.length})
            </FilterChip>
            {counts.map(({ status: s, count }) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s.replace(/_/g, " ")} ({count})
              </FilterChip>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.03]">
                <tr>
                  <Th>Order</Th>
                  <Th className="hidden sm:table-cell">Customer</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Placed</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr
                    key={order.orderNumber}
                    className="border-b border-foreground/8 last:border-b-0 hover:bg-foreground/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="font-mono text-xs font-semibold text-foreground hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="block text-xs text-foreground/45">
                        {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="block text-foreground">{order.customerName}</span>
                      <span className="block text-xs text-foreground/45">{order.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-xs tabular-nums text-foreground/55 md:table-cell">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      {formatPrice(order.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visible.length === 0 && (
            <p className="mt-4 text-sm text-foreground/55">No orders with that status.</p>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.03]">
              <tr>
                <Th>Recipient</Th>
                <Th className="hidden sm:table-cell">To</Th>
                <Th className="hidden md:table-cell">Template</Th>
                <Th className="text-right">Result</Th>
              </tr>
            </thead>
            <tbody>
              {emails.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-foreground/8 last:border-b-0 hover:bg-foreground/[0.02]"
                >
                  <td className="px-4 py-3">
                    <span className="block text-foreground">{entry.subject}</span>
                    <span className="block text-xs text-foreground/45">
                      {new Date(entry.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-foreground/60 sm:table-cell">
                    {entry.toEmail}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-foreground/60 md:table-cell">
                    {entry.template.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                        entry.status === "sent"
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-500/12 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminGate() {
  return (
    <div className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
      <h2 className="text-lg font-semibold text-foreground">Admin access required</h2>
      <p className="mt-2 text-sm text-foreground/60">
        Sign in with the store owner account to see fulfillment.
      </p>
      <Link
        href="/login?redirectTo=/admin"
        className="mt-5 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        Sign in as owner
      </Link>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground/45 ${className}`}
    >
      {children}
    </th>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center rounded-full px-3.5 text-xs font-medium capitalize transition-colors ${
        active
          ? "bg-foreground text-background"
          : "border border-foreground/15 text-foreground/65 hover:border-foreground/35"
      }`}
    >
      {children}
    </button>
  );
}