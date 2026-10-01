import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service role. Bypasses RLS entirely, so it must never reach a Client
// Component or any code that runs in the browser. `server-only` makes an
// accidental client import a build error rather than a data leak.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
