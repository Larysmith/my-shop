import Link from "next/link";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  formatPrice,
} from "@/lib/pricing";

type CartSummaryProps = {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
};

export default function CartSummary({
  subtotalCents,
  shippingCents,
  totalCents,
  itemCount,
}: CartSummaryProps) {
  const remainingCents = FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents;

  return (
    <div className="rounded-2xl border border-foreground/10 p-6 lg:sticky lg:top-24">
      <h2 className="text-base font-semibold text-foreground">Order summary</h2>

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-foreground/60">
            Subtotal{itemCount > 0 && ` (${itemCount} item${itemCount === 1 ? "" : "s"})`}
          </dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatPrice(subtotalCents)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-foreground/60">Shipping</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {shippingCents === 0 ? "Free" : formatPrice(shippingCents)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-foreground/10 pt-3">
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {formatPrice(totalCents)}
          </dd>
        </div>
      </dl>

      {remainingCents > 0 && (
        <p className="mt-4 rounded-lg bg-foreground/5 px-3 py-2 text-xs text-foreground/70">
          Add {formatPrice(remainingCents)} more for free shipping.
        </p>
      )}

      <Link
        href="/checkout"
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        Proceed to checkout
      </Link>
    </div>
  );
}
