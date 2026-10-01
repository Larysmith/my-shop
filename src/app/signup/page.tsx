import type { Metadata } from "next";
import Link from "next/link";
import SignUpForm from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create an account to see your orders in one place.",
};

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Create account
        </h1>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          An account lets you see every order placed with your email. You can still check out
          as a guest.
        </p>
      </header>

      <div className="mt-8">
        <SignUpForm />
      </div>

      <p className="mt-8 text-sm text-foreground/55">
        Already have one?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}