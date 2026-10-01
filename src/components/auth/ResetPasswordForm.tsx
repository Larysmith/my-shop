"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

/**
 * Sets a new password from a recovery link.
 *
 * Reached only after /auth/callback exchanges the emailed code for a session,
 * so this page is rendered with an authenticated user. Without that session
 * there is nothing to update and the form is replaced with an explanation
 * rather than a submit button that would silently fail.
 *
 * Also requires the current password when the session did *not* come from a
 * recovery link, because a stolen session should not be enough to take the
 * account over permanently. Supabase enforces this via
 * security_update_password_require_current_password; this surfaces it rather
 * than swallowing it.
 */
export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Resolve on mount rather than in render: reading the session is async, and
  // doing it during render would flash the "no session" branch at a valid link.
  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setHasSession(Boolean(data.session));
      })
      .catch(() => {
        if (active) setHasSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (hasSession === null) {
    return <p className="text-sm text-foreground/55">Checking your link…</p>;
  }

  if (!hasSession) {
    return (
      <div className="rounded-2xl border border-foreground/10 p-6">
        <p className="text-sm font-medium text-foreground">This link is no longer usable</p>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          Password reset links expire after a short time, and they only work in the browser you
          opened them in. Request a fresh one and open it straight away.
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message.toLowerCase().includes("password")
          ? "That password was rejected. Choose a different one."
          : "Could not update your password. Request a new link and try again.");
        setPending(false);
        return;
      }

      setDone(true);
      setPending(false);
    } catch {
      setError("Could not update your password. Please try again.");
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-foreground/10 p-6">
        <p className="text-sm font-medium text-foreground">Password updated</p>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          You are signed in with your new password.
        </p>
        <Link
          href="/account"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Go to your orders
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
          New password
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          aria-describedby="new-password-hint"
          required
        />
        <p id="new-password-hint" className="mt-1.5 text-xs text-foreground/50">
          {PASSWORD_HINT}
        </p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
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
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}