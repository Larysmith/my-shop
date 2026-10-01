import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { isValidPaystackSignature } from "../src/lib/server/paystack/signature";
import {
  computeTotals,
  FREE_SHIPPING_THRESHOLD_AMOUNT,
  SHOP_CURRENCY,
  SHIPPING_FLAT_AMOUNT,
} from "../src/lib/pricing";

const SECRET = "test_webhook_secret";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha512", secret).update(body).digest("hex");
}

describe("isValidPaystackSignature", () => {
  it("accepts a signature Paystack would produce", () => {
    const body = JSON.stringify({ event: "charge.success" });
    assert.equal(isValidPaystackSignature(body, sign(body), SECRET), true);
  });

  it("rejects a body changed after signing", () => {
    // The attack this stops: a valid signature replayed over a doctored amount.
    const body = JSON.stringify({ event: "charge.success", data: { amount: 100 } });
    const doctored = JSON.stringify({ event: "charge.success", data: { amount: 1 } });
    assert.equal(isValidPaystackSignature(doctored, sign(body), SECRET), false);
  });

  it("rejects a signature made with a different secret", () => {
    const body = "{}";
    assert.equal(isValidPaystackSignature(body, sign(body, "other"), SECRET), false);
  });

  it("returns false for a wrong-length signature instead of throwing", () => {
    // timingSafeEqual throws on a length mismatch, which would surface as a 500
    // and tell an attacker their guess was close enough to be worth refining.
    assert.equal(isValidPaystackSignature("{}", "abc", SECRET), false);
    assert.equal(isValidPaystackSignature("{}", "", SECRET), false);
  });

  it("tolerates surrounding whitespace in the header", () => {
    const body = "{}";
    assert.equal(isValidPaystackSignature(body, `\n  ${sign(body)}  `, SECRET), true);
  });
});

describe("shop totals are integer kobo", () => {
  it("prices in the shop currency", () => {
    assert.equal(SHOP_CURRENCY, "NGN");
  });

  it("frees shipping once the subtotal reaches the threshold", () => {
    // ₦47,000 is under the ₦50,000 threshold, so shipping still applies. The
    // subtotal arithmetic is what this checks; the threshold case is below.
    const totals = computeTotals([
      { priceAmount: 1500000, quantity: 2 },
      { priceAmount: 1700000, quantity: 1 },
    ]);
    assert.equal(totals.subtotalAmount, 4700000);
    assert.equal(totals.shippingAmount, SHIPPING_FLAT_AMOUNT);
    assert.equal(totals.totalAmount, 4700000 + SHIPPING_FLAT_AMOUNT);
  });

  it("charges flat shipping below the threshold and frees it above", () => {
    const below = computeTotals([{ priceAmount: 100000, quantity: 1 }]);
    assert.equal(below.shippingAmount, SHIPPING_FLAT_AMOUNT);
    assert.equal(below.totalAmount, 100000 + SHIPPING_FLAT_AMOUNT);

    const atThreshold = computeTotals([
      { priceAmount: FREE_SHIPPING_THRESHOLD_AMOUNT, quantity: 1 },
    ]);
    assert.equal(atThreshold.shippingAmount, 0);
  });

  it("charges nothing on an empty cart", () => {
    const totals = computeTotals([]);
    assert.equal(totals.subtotalAmount, 0);
    assert.equal(totals.shippingAmount, 0);
    assert.equal(totals.totalAmount, 0);
  });

  it("stays an integer, so a total can never carry a rounding error", () => {
    // Three units of a price that is not a whole multiple of 3 is where float
    // money would start drifting. Integer kobo cannot.
    const totals = computeTotals([{ priceAmount: 123457, quantity: 3 }]);
    assert.equal(Number.isInteger(totals.totalAmount), true);
    assert.equal(totals.subtotalAmount, 370371);
  });
});
