import type { Metadata } from "next";
import Link from "next/link";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Reset your password
        </h1>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          We will email you a link to choose a new one.
        </p>
      </header>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-8 text-sm text-foreground/55">
        Remembered it?{" "}
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