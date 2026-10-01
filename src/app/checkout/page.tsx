import type { Metadata } from "next";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { DEMO_MODE } from "@/lib/demo/types";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Checkout
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/60">
          {DEMO_MODE
            ? "Guest checkout. Enter any email — no payment is taken in demo mode."
            : "Guest checkout is allowed. Payment is handled by Stripe."}
        </p>
      </header>

      <div className="mt-8">
        <CheckoutForm />
      </div>
    </div>
  );
}
