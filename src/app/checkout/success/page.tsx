import type { Metadata } from "next";
import { Suspense } from "react";
import SuccessView from "@/components/checkout/SuccessView";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Suspense
        fallback={<p className="text-sm text-foreground/55">Loading your order…</p>}
      >
        <SuccessView />
      </Suspense>
    </div>
  );
}
