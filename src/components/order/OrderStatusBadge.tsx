/**
 * Order status pill.
 *
 * No `"use client"`: this is a pure presentational component so it can be
 * rendered from both Server and Client Components. `status` is a plain string
 * because it comes from the database, where it is free text rather than a union
 * the TypeScript side controls.
 */
const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  paid: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  shipped: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-400",
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  canceled: "bg-foreground/8 text-foreground/60",
  refunded: "bg-foreground/8 text-foreground/60",
};

export default function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
        STATUS_STYLE[status] ?? "bg-foreground/8 text-foreground/60"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}