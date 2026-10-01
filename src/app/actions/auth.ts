"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs the user out and returns to the home page.
 *
 * A Server Action rather than a browser-side call: the session cookie is
 * httpOnly, so only server code can clear it. Doing it here also means the
 * redirect happens in the same round-trip rather than needing client
 * navigation afterwards.
 *
 * The cookie write has to happen in the Action. `createClient` is also used by
 * Server Components, where cookies are read-only and the write is swallowed —
 * see the catch in src/lib/supabase/server.ts.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();
  if (error) {
    // Never leave the user apparently signed in. Send them to the login page
    // rather than the home page so the failure is visible and recoverable.
    console.error("sign out failed:", error.message);
    redirect("/login?error=signout");
  }

  redirect("/");
}