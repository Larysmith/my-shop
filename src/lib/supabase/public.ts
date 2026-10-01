import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * A cookie-free Supabase client for public, cacheable reads.
 *
 * `createServerClient` in `@/lib/supabase/server` reads cookies, which makes the
 * caller dynamic — and unusable inside `generateStaticParams`, which runs at
 * build time with no request. The publishable key is the `anon` role, so RLS
 * still applies exactly as it does for a visitor: this sees only active products
 * and active variants. It is *not* a privilege escalation.
 *
 * Use this only where the caller cannot have a session. Anything user-scoped must
 * go through the cookie-backed client or the service role.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}