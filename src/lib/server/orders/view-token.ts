import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed capability for viewing one order after payment.
 *
 * Problem: `/checkout/success?order=LS-XXXXXX` is reached by redirect from
 * Paystack, and the buyer may be a guest with no session. Reading the order by
 * number alone would expose any order to anyone who guessed or scraped a
 * six-character code — order numbers are not secret, since they appear in emails.
 *
 * A session cannot be used either: a guest has none.
 *
 * So the checkout Server Action signs the order number and puts the signature in
 * the callback URL. Whoever arrives holding a valid signature was redirected from
 * a checkout this shop started, which is exactly the buyer. The signature covers
 * the order number, so it cannot be moved to a different order, and it carries no
 * expiry because a payment confirmation link should keep working.
 */

function signingKey(): string {
  // The Paystack webhook secret is the server-side secret this shop already
  // requires. Reusing it avoids adding an env var that could be missing in
  // production while this one is definitely set.
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Missing required environment variable PAYSTACK_WEBHOOK_SECRET. Order confirmation links cannot be signed.",
    );
  }
  return secret;
}

export function signOrderToken(orderNumber: string): string {
  const digest = createHmac("sha256", signingKey())
    .update(`order-view:${orderNumber}`)
    .digest("base64url");

  return `${orderNumber}.${digest}`;
}

/** Returns the order number if the token is authentic, otherwise null. */
export function verifyOrderToken(token: string | null): string | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const orderNumber = token.slice(0, separator);
  const given = token.slice(separator + 1);

  const expected = createHmac("sha256", signingKey())
    .update(`order-view:${orderNumber}`)
    .digest("base64url");

  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(given, "utf8");

  // timingSafeEqual throws on a length mismatch, which would turn a bad token
  // into a 500 and tell an attacker their guess was close.
  if (expectedBuf.length !== givenBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, givenBuf)) return null;

  return orderNumber;
}