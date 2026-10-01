"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUTTON =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.5l2.63-2.53C16.8 3.24 14.6 2.2 12 2.2 6.98 2.2 2.9 6.28 2.9 11.3S6.98 20.4 12 20.4c5.72 0 9.52-4.02 9.52-9.68 0-.65-.07-1.15-.16-1.65H12Z"
      />
    </svg>
  );
}

/**
 * Starts a Google sign-in through Supabase Auth's PKCE flow.
 *
 * `next` is carried through the redirect and validated against an allowlist in
 * /auth/callback. It is deliberately not trusted here: it is attacker-supplied
 * once the URL can be shared or bookmarked.
 */
export default function GoogleSignInButton({
  next = "/account",
  label = "Sign in with Google",
  className = BUTTON,
}: {
  next?: string;
  label?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          // No flowType is set: createBrowserClient from @supabase/ssr already
          // defaults to PKCE, which keeps the code verifier in a cookie the
          // callback route can read. No client secret is involved anywhere.
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });

      if (oauthError) throw oauthError;
      // On success the browser navigates to Google, so there is nothing to do.
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not start Google sign-in. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={handleClick} disabled={pending} className={className}>
        <GoogleMark />
        {pending ? "Opening Google…" : label}
      </button>
      {error && (
        <span role="alert" className="mt-1 max-w-56 text-[11px] text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}