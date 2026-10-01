"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import PasswordSignInForm from "@/components/auth/PasswordSignInForm";
import { useDemo } from "@/components/demo/DemoProvider";
import { DEMO_MODE } from "@/lib/demo/types";

const INPUT =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none";

const ERROR_COPY: Record<string, string> = {
  auth: "Sign-in did not complete. Please try again.",
  access_denied: "Sign-in was cancelled.",
};

export default function LoginView() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  // /auth/callback sends the visitor here on any failure, with one opaque code.
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? (ERROR_COPY[errorCode] ?? ERROR_COPY.auth)
    : null;

  if (!loading && user) {
    return (
      <div className="rounded-2xl border border-foreground/10 p-6">
        <p className="text-sm text-foreground/60">You are signed in as</p>
        <p className="mt-1 text-base font-semibold text-foreground">{user.email}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={user.isAdmin ? "/admin" : "/account"}
            className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            {user.isAdmin ? "Open admin" : "View your orders"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      {errorMessage && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400"
        >
          {errorMessage}
        </p>
      )}

      {DEMO_MODE ? (
        <>
          <DemoSignIn />
          <p className="mt-6 text-xs leading-5 text-foreground/50">
            Demo mode uses seeded accounts instead of real Google OAuth.
          </p>
        </>
      ) : (
        <>
          <GoogleSignInButton className="h-11 w-full" />
          <Divider />
          <PasswordSignInForm />
          <p className="mt-6 text-sm leading-6 text-foreground/55">
            Need an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Create one
            </Link>
            . You can also{" "}
            <Link href="/track-order" className="underline underline-offset-2">
              track an order
            </Link>{" "}
            without signing in.
          </p>
        </>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-foreground/12" />
      <span className="text-xs uppercase tracking-wider text-foreground/40">or</span>
      <span className="h-px flex-1 bg-foreground/12" />
    </div>
  );
}

/**
 * Demo-only account picker.
 *
 * Split into its own component because it calls useDemo(), which throws outside
 * <DemoProvider>. Keeping it here means it is only ever mounted when the demo
 * provider exists, instead of the whole page crashing in production.
 */
function DemoSignIn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signIn, availableAccounts } = useDemo();

  const redirectTo = searchParams.get("redirectTo") ?? "/account";
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function go(accountIsAdmin: boolean) {
    router.push(accountIsAdmin && redirectTo === "/account" ? "/admin" : redirectTo);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const account = signIn(email);
    if (!account) {
      setError("No demo account uses that email. Pick one of the accounts above.");
      return;
    }
    go(account.isAdmin);
  }

  return (
    <>
      {/* Accounts come first: they are the fastest path for a reviewer, and the
          form below only ever accepts these same three addresses. */}
      <div className="rounded-2xl border border-foreground/10 p-4">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/45">
            Demo accounts
          </p>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Demo mode
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {availableAccounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                onClick={() => {
                  signIn(account.email);
                  go(account.isAdmin);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-foreground/12 px-3.5 py-2.5 text-left transition-colors hover:border-foreground/30"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {account.email}
                  </span>
                  <span className="block text-xs text-foreground/50">{account.fullName}</span>
                </span>
                <span className="shrink-0 rounded-full bg-foreground/8 px-2.5 py-1 text-[11px] font-medium text-foreground/60">
                  {account.isAdmin ? "admin" : "buyer"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@example.com"
            className={`mt-1.5 ${INPUT}`}
            required
          />
          {error && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Continue
        </button>
      </form>
    </>
  );
}