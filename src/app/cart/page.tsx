import type { Metadata } from "next";
import CartView from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your cart before checking out.",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Your cart
      </h1>
      <div className="mt-8">
        <CartView />
      </div>
    </div>
  );
}
