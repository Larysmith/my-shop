import "server-only";

/**
 * The shop's public origin, used to build every redirect and every link that
 * leaves the server.
 *
 * Not provider-specific: Paystack callback URLs, email links and share links all
 * need it, so it does not belong to a payments module.
 */
export function requireSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error(
      "Missing required environment variable NEXT_PUBLIC_SITE_URL. Outbound URLs are built from it.",
    );
  }
  // A trailing slash would produce "//path" when concatenated.
  return url.replace(/\/+$/, "");
}