"use client";

import Link from "next/link";
import CartLineItem from "./CartLineItem";
import CartSummary from "./CartSummary";
import { useCart } from "./useCart";

export default function CartView() {
  const { lines, itemCount, subtotalAmount, shippingAmount, totalAmount, hydrated } =
    useCart();

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-foreground/10 px-6 py-16 text-center text-sm text-foreground/60">
        Loading your cart…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 px-6 py-16 text-center">
        <h2 className="text-base font-semibold text-foreground">Your cart is empty</h2>
        <p className="mt-2 text-sm text-foreground/60">
          Nothing here yet. Browse the collection and add something you like.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Shop all products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-16">
      <ul className="divide-y divide-foreground/10 border-b border-foreground/10 lg:border-b-0">
        {lines.map((line) => (
          <CartLineItem key={line.productId} line={line} />
        ))}
      </ul>

      <CartSummary
        subtotalAmount={subtotalAmount}
        shippingAmount={shippingAmount}
        totalAmount={totalAmount}
        itemCount={itemCount}
      />
    </div>
  );
}
