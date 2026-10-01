import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Next 16 renamed the `middleware` convention to `proxy`, and the export must
// be named `proxy` (or default). A `middleware.ts` export is deprecated.
export async function proxy(request: NextRequest) {
  // Demo mode is fully self-contained: no Supabase, no auth, no network. Skip
  // the session refresh entirely so a missing or broken key can never take the
  // showcase down.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const { NextResponse } = await import("next/server");
    return NextResponse.next({ request });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets and image optimisation, so a
     * stale session cookie cannot leak into a rendered page.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
