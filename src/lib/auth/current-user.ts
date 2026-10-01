import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/types";
import type { AuthUser } from "./types";

/**
 * Reads the current session on the server and returns a minimal, serialisable
 * user.
 *
 * Runs on the server because the session lives in an httpOnly cookie that
 * JavaScript cannot read. Fetching it in the browser would need a round-trip
 * after every render, and would produce a different first paint.
 *
 * `is_admin` is read from the caller's own `profiles` row through their own
 * session, so RLS scopes it to them. The service-role client is never used
 * here: it bypasses RLS and would leak other users' admin status.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // Demo state lives in localStorage and is unreadable from the server, so the
  // server legitimately has no user to report. Callers fall back to the demo
  // context on the client.
  if (DEMO_MODE) return null;

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? "",
    fullName:
      profile?.full_name ??
      (metadata.full_name as string | undefined) ??
      (metadata.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Customer",
    avatarUrl: (metadata.avatar_url as string | undefined) ?? null,
    isAdmin: Boolean(profile?.is_admin),
  };
}