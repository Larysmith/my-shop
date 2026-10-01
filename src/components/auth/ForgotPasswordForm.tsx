"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INPUT =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none";

/**
 * Requests a password reset link.
 *
 * The success message is deliberately unconditional. Whether the address has an
 * account is not disclosed, so this cannot be used to discover which emails are
 * registered — Supabase also returns success for unknown addresses, so the two
 * behaviours match and the timing does not give it away either.
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        "/reset-password",
      )}`;

      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );

      if (resetError) {
        // Rate limiting is the realistic failure here and is worth naming;
        // anything else still gets the neutral success path below, so a
        // misconfigured mailer cannot be turned into an enumeration oracle.
        if (/rate|too many/i.test(resetError.message)) {
          setError("Too many requests. Wait a minute and try again.");
          setPending(false);
          return;
        }
      }

      setSent(true);
      setPending(false);
    } catch {
      setError("Could not send the email. Please try again.");
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-foreground/10 p-6">
        <p className="text-sm font-medium text-foreground">Check your email</p>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          If that address has an account, a reset link is on its way. Open it in this browser —
          the link only works there.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="reset-email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          className={`mt-1.5 ${INPUT}`}
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}