import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * The two values are inlined into the bundle at build time, so on Vercel they must
 * be set as `NEXT_PUBLIC_*` project variables — a server-only copy never reaches
 * the browser. Read statically for that reason: only static property access gets
 * inlined.
 *
 * `@/lib/server/env` cannot be used here because it is `server-only`, so the
 * missing-value case is handled locally. Without this, an unconfigured deploy
 * fails inside `createBrowserClient` with an opaque error the moment a visitor
 * presses "Sign in with Google".
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_PUBLISHABLE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Supabase is not configured: missing ${missing.join(", ")}. ` +
        `These are inlined into the browser bundle at build time, so they must be set ` +
        `as NEXT_PUBLIC_* environment variables on the Vercel project and the project ` +
        `rebuilt.`,
    );
  }

  return createBrowserClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!);
}