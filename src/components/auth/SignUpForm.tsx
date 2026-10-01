"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

const INPUT =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none";

/**
 * Account creation.
 *
 * Two distinct success paths, because the Supabase project's email confirmation
 * setting decides which one runs:
 *
 *  - session returned  → the account is usable immediately, so go straight in.
 *  - no session, user returned → confirmation email is required; say so and stop,
 *    because pushing to `next` would land on a protected page the user cannot
 *    yet pass.
 *
 * The password is never logged or echoed back.
 */
export default function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const { data, error: signUpError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account` },
      });

      if (signUpError) {
        setError(describe(signUpError.message));
        setPending(false);
        return;
      }

      if (data.session) {
        // Confirmation is off, so the account is already usable. refresh() so
        // Server Components re-read the session cookie set by sign-up.
        router.push("/account");
        router.refresh();
        return;
      }

      setAwaitingConfirmation(true);
      setPending(false);
    } catch {
      setError("Could not create your account. Please try again.");
      setPending(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="rounded-2xl border border-foreground/10 p-6">
        <p className="text-sm font-medium text-foreground">Check your email</p>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{email.trim()}</span>. Open it to
          finish creating your account, then come back and sign in.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="signup-email"
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

      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          // Matches the Supabase project's password_min_length exactly. Stating a
          // stricter number here would silently reject passwords the server
          // accepts, which reads as a bug rather than a rule.
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          aria-describedby="signup-password-hint"
          required
        />
        <p id="signup-password-hint" className="mt-1.5 text-xs text-foreground/50">
          {PASSWORD_HINT}
        </p>
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
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

/**
 * Turns a Supabase auth error into something a shopper can act on.
 *
 * Passed the raw message only inside this function; nothing is logged, because
 * these messages can contain the submitted address.
 */
function describe(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account already exists for that email. Try signing in instead.";
  }
  if (lower.includes("password")) {
    return "Choose a longer password, or one without characters Supabase rejects.";
  }
  if (lower.includes("email") && lower.includes("valid")) {
    return "Enter a valid email address.";
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "Could not create your account. Please try again.";
}