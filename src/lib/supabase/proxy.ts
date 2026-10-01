import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE } from "@/lib/demo/types";

// Runs on every matched request to refresh the auth cookie before render, and
// to enforce the /account and /admin guards. Lives outside the app directory
// so it can be imported by both proxy.ts and server actions without pulling in
// `next/headers`.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
          // Session responses must never be cached by a CDN, otherwise one
          // buyer's token can be served to another buyer.
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims: it can start a
  // token refresh that writes cookies out of sync with supabaseResponse.
  // getClaims() verifies the JWT signature locally, so a forged cookie is
  // rejected without a network round trip. It returns null when signed out.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { pathname } = request.nextUrl;

  // Demo mode has no Supabase session at all: the demo session lives in
  // localStorage, so there is no cookie to find and `claims` is always null.
  // Applying the guard here would bounce every demo visitor off /account and
  // /admin to the login page, which is exactly what those pages must show in
  // demo mode.
  if (
    !DEMO_MODE &&
    !claims &&
    (pathname.startsWith("/account") || pathname.startsWith("/admin"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
