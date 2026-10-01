import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import TrackOrderForm from "@/components/order/TrackOrderForm";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Look up any Lary Shop order with your order number and email.",
};

export default function TrackOrderPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Track your order
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/60">
          Guest checkout means there is no account to sign in to. Enter your order number and
          the email you used instead.
        </p>
      </header>

      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-foreground/55">Loading…</p>}>
          <TrackOrderForm />
        </Suspense>
      </div>

      <p className="mt-10 text-sm text-foreground/55">
        Signed in instead?{" "}
        <Link href="/account" className="font-medium text-foreground underline underline-offset-4">
          See your order history
        </Link>
        .
      </p>
    </div>
  );
}
