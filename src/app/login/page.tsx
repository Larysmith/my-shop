import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import LoginView from "@/components/auth/LoginView";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Sign in
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/60">
          One click with Google. Signing in links any guest orders placed with the same email.
        </p>
      </header>

      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-foreground/55">Loading…</p>}>
          <LoginView />
        </Suspense>
      </div>

      <p className="mt-10 text-sm text-foreground/55">
        Just want to check on a delivery?{" "}
        <Link
          href="/track-order"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Track it with your order number
        </Link>
        .
      </p>
    </div>
  );
}
