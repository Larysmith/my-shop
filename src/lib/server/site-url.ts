import "server-only";

import { MissingEnvError } from "@/lib/server/env";

/** `localhost`, `127.0.0.1` and `[::1]`, with an optional port. */
const LOCAL_ORIGIN = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * The shop's public origin, used to build every redirect and every link that
 * leaves the server.
 *
 * Not provider-specific: Paystack callback URLs, email links and share links all
 * need it, so it does not belong to a payments module.
 */
export function requireSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new MissingEnvError(["NEXT_PUBLIC_SITE_URL"]);

  const host = url.replace(/^https?:\/\//, "");

  // A local origin is a legitimate development setting, but it is never the right
  // value on a deployed host: Paystack cannot POST a webhook to localhost, and a
  // customer emailed that link would be sent nowhere useful. The deploy is
  // detected from the host's own environment rather than from the URL, so that
  // running the suite in production mode against a local server still works.
  if (process.env.NETLIFY === "true" && LOCAL_ORIGIN.test(host)) {
    throw new MissingEnvError(["NEXT_PUBLIC_SITE_URL (set to the deployed domain)"]);
  }

  // A trailing slash would produce "//path" when concatenated.
  return url.replace(/\/+$/, "");
}
