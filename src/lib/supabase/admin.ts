import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireEnv, requireSupabaseSecretEnv } from "@/lib/server/env";

// Service role. Bypasses RLS entirely, so it must never reach a Client
// Component or any code that runs in the browser. `server-only` makes an
// accidental client import a build error rather than a data leak.
export function createAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");

  return createClient(url, requireSupabaseSecretEnv(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
