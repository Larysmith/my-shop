"use client";

import { useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Reads the post-auth redirect target from the login URL.
 *
 * Two parameter names are in use across the app: `next` is what GoogleSignInButton
 * and /auth/callback pass, while `redirectTo` predates it and is what the demo
 * flow and existing deep links use. Both are accepted so a bookmarked link does
 * not silently lose its destination.
 *
 * The value is attacker-controlled, so it goes through safeNext rather than
 * being used verbatim. This matters more than usual after a password sign-in:
 * the user is by then trusted, so an unvalidated target would turn the login
 * page into an open redirect for a freshly authenticated session.
 *
 * Falls back to "/" during the server render, where there is no origin and
 * useSearchParams returns empty. The result is only ever read inside an event
 * handler, after hydration, so that fallback is never acted upon.
 */
export function useSafeNextParam(): string {
  const searchParams = useSearchParams();

  if (typeof window === "undefined") return "/";

  const raw = searchParams.get("next") ?? searchParams.get("redirectTo");
  return safeNext(raw, window.location.origin);
}