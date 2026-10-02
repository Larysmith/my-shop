import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireEnv, requireSupabasePublicEnv } from "@/lib/server/env";

// Service role. Bypasses RLS entirely, so it must never reach a Client
// Component or any code that runs in the browser. `server-only` makes an
// accidental client import a build error rather than a data leak.
export function createAdminClient() {
  const { url } = requireSupabasePublicEnv();

  return createClient(url, requireEnv("SUPABASE_SECRET_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
