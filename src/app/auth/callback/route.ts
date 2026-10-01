import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

// Exchanges the PKCE authorization code for a session, then sends the visitor
// on to `next`. Must not be cached: a code is single-use, so every visit has to
// reach the handler.
export const dynamic = "force-dynamic";

// One opaque failure value on purpose. Distinct codes per branch would tell an
// attacker which part of the flow succeeded, for no benefit to the user.
const FAILURE = "/login?error=auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // Google returns ?error=access_denied when the user declines consent. There
  // is no code to exchange in that case, so it is a failure like any other.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}${FAILURE}`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}${FAILURE}`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;

    return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"), origin)}`);
  } catch (caught) {
    // The cause is logged server-side; the redirect carries no detail.
    console.error(
      "auth/callback failed:",
      caught instanceof Error ? caught.message : String(caught),
    );
    return NextResponse.redirect(`${origin}${FAILURE}`);
  }
}