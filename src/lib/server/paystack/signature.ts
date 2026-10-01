import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signature verification, kept separate from the route and the REST
 * client so it can be tested directly.
 *
 * The signature is an HMAC-SHA512 of the **raw** request body keyed with the
 * webhook secret, sent as `x-paystack-signature`. It covers the bytes exactly as
 * received, so it must be checked before `JSON.parse` and before any framework
 * touches the body: re-serializing a parsed object changes key order and
 * whitespace, which produces a different digest and rejects a legitimate event.
 */
export function isValidPaystackSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(signature.trim(), "utf8");

  // timingSafeEqual throws on a length mismatch, which would leak information
  // through a 500. Compare lengths first.
  if (expectedBuf.length !== givenBuf.length) return false;

  return timingSafeEqual(expectedBuf, givenBuf);
}
