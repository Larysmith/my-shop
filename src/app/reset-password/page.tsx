import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

// Never prerendered: the page depends on a recovery session created by
// /auth/callback, which only exists for the request that carries the code.
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          This replaces the password you signed up with.
        </p>
      </header>

      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}