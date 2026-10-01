"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSafeNextParam } from "./useSafeNextParam";

const INPUT =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3.5 text-sm text-foreground placeholder:text-foreground/35 focus:border-foreground/40 focus:outline-none";

/**
 * Email and password sign-in.
 *
 * Separate component from LoginView because it needs no demo context, so it can
 * be mounted on its own in production without dragging DemoProvider in.
 */
export default function PasswordSignInForm() {
  const router = useRouter();
  const next = useSafeNextParam();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Deliberately a single message for both "no such user" and "wrong
        // password". Distinguishing them would turn this form into a tool for
        // discovering which emails have accounts.
        setError("That email and password combination did not work.");
        setPending(false);
        return;
      }

      // refresh() so Server Components re-read the session cookie; the navbar
      // and any guarded page would otherwise still render the signed-out view.
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not sign you in. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="signin-email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="signin-email"
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
        <label htmlFor="signin-password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}