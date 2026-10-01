/**
 * Reports the exact OAuth values a Google Cloud Console setup must contain for
 * this project, so the console settings can be checked against real output
 * rather than guesswork.
 *
 * Prints no secrets.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];

// Supabase is the OAuth client. Google redirects here, not to the app, so this
// is the value that must be registered in the console.
const supabaseCallback = ref
  ? `https://${ref}.supabase.co/auth/v1/callback`
  : "<set NEXT_PUBLIC_SUPABASE_URL>";

console.log(`
Google Cloud Console — required values
======================================

Project
  Google Cloud project id     : <the project holding the OAuth client>
  OAuth consent screen        : External, with your shop name, support email,
                                 and developer contact email

OAuth client (Credentials -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs)

  Application type            : Web application

  Authorized redirect URI     : ${supabaseCallback}
  Authorized JavaScript origin: ${siteUrl}

  Client ID                   : paste into Supabase Dashboard -> Authentication
                                 -> Providers -> Google -> Client ID
  Client secret               : paste into the same Supabase field

Why these exact values
  Google sends the browser to Supabase's callback, never to the app. Supabase
  holds the client secret and exchanges the code server-side, so the secret
  never reaches this codebase and must NOT appear in .env.local.

Supabase must also know where to send the browser back afterwards
  Dashboard -> Authentication -> URL Configuration
    Site URL                        = ${siteUrl}
    Redirect URLs (allow-list)      = ${siteUrl}/auth/callback
                                      ${siteUrl}/**

Testing note
  ${siteUrl} is not reachable from Google's servers, which is expected for
  local work. The full flow only completes end to end once the app is deployed
  to a public https origin; add that origin's callback to both lists at that point.
`);
