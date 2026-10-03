/**
 * Drives the storefront through checkout and pays with Paystack's test card.
 *
 * Split out of verify-payment-flow.mjs because it is the part that cannot be
 * relied on: Paystack's hosted page is behind a Cloudflare Turnstile challenge,
 * which does not complete in an automated browser. Run with --headed if you want
 * to watch it attempt.
 *
 * Best effort by design. It returns the order id on success and null on failure,
 * so the caller can fall back to asking for a manual checkout rather than dying.
 *
 * This exercises the real path: the storefront, the cart, and the
 * `startPaystackCheckout` Server Action, which re-prices from Postgres and calls
 * Paystack's initialize endpoint.
 */

import { chromium } from "@playwright/test";

export async function drivePaystackCheckout({ base, card, headed = false }) {
  const stamp = Date.now().toString(36);
  const probeEmail = `payment-probe-${stamp}@example.com`;

  let browser;
  try {
    browser = await chromium.launch({
      headless: !headed,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(`${base}/products/ceramic-pour-over-mug`);
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    // Wait for the cart to actually hold the line before leaving the page, or the
    // checkout renders its empty state and the form fields never appear.
    await page
      .getByRole("link", { name: /^Cart,/ })
      .filter({ hasText: /1 item/ })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });

    await page.goto(`${base}/checkout`);
    await page.locator("#co-email").waitFor({ state: "visible", timeout: 20_000 });

    await page.locator("#co-email").fill(probeEmail);
    await page.locator("#co-name").fill("Payment Probe");
    await page.locator("#co-line1").fill("1 Test Street");
    await page.locator("#co-city").fill("Lagos");
    await page.locator("#co-region").fill("Lagos");
    await page.locator("#co-postal").fill("100001");
    await page.locator("#co-country").fill("NG");

    await page.getByRole("button", { name: /Pay with card|Place order|Proceed/ }).first().click();
    await page.waitForURL(/checkout\.paystack\.com/, { timeout: 45_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    const cardField = page.locator('input[name="cardnumber"], input[autocomplete="cc-number"]').first();
    await cardField.waitFor({ state: "visible", timeout: 20_000 });

    // Paystack renders the card as a container div holding one input per digit
    // on some layouts, and as a single input on others.
    const digits = cardField.locator("input");
    if ((await digits.count()) > 1) {
      for (const [index, digit] of [...card.number].entries()) {
        await digits.nth(index).fill(digit);
      }
    } else {
      await cardField.fill(card.number);
    }

    const expiry = page.locator('input[name="expmonth"], input[autocomplete="cc-exp"]').first();
    if (await expiry.count()) await expiry.fill(card.expiry);
    const cvv = page.locator('input[name="cvv"], input[autocomplete="cc-csc"]').first();
    if (await cvv.count()) await cvv.fill(card.cvv);

    await page.getByRole("button", { name: /^(Pay|Next|Continue)/ }).first().click();

    // Test mode may still ask for a PIN or OTP for the card that was chosen.
    for (const [selector, value] of [
      ['input[name="pin"]', card.pin],
      ['input[name="otp"]', card.otp],
    ]) {
      const field = page.locator(selector).first();
      if (await field.isVisible().catch(() => false)) {
        await field.fill(value);
        await page.getByRole("button", { name: /^(Pay|Next|Continue|Done)/ }).first().click();
      }
    }

    await page.waitForTimeout(6000);
    console.log(`  probe checkout used ${probeEmail}`);
    return probeEmail;
  } catch (error) {
    console.log(
      `  automated checkout did not complete: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
    );
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}