import { expect, test } from "@playwright/test";

/**
 * Production mode (NEXT_PUBLIC_DEMO_MODE=false).
 *
 * Separate from demo-flow.spec.ts because the two modes are mutually exclusive at
 * runtime: the demo suite seeds localStorage accounts that do not exist here, and
 * asserting on a demo account picker would pass for the wrong reason.
 *
 * Only assertions that hold without credentials or a payment are made here. A
 * real Paystack checkout is not exercised by the suite.
 *
 * The `production` Playwright project pins this file to a server booted with
 * NEXT_PUBLIC_DEMO_MODE=false on port 3002; `npm run test:e2e` starts it.
 */

test.describe("production mode", () => {
  test("the Google sign-in button is visible on the login page", async ({ page }) => {
    await page.goto("/login");

    // This is the whole point of flipping the flag: DEMO_MODE gates the login UI,
    // and the button only mounts on the production branch.
    // Scoped to <main>: the navbar renders its own Google button on wide
    // viewports, so an unscoped lookup matches two elements.
    await expect(
      page.getByRole("main").getByRole("button", { name: "Sign in with Google" }),
    ).toBeVisible();

    // And the demo picker must be gone, or the flag did not take effect.
    await expect(page.getByText("Demo accounts")).toHaveCount(0);
  });

  test("the navbar offers Google sign-in rather than a plain login link", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page
        .getByRole("navigation", { name: "Main" })
        .getByRole("button", { name: "Sign in with Google" }),
    ).toBeVisible();
  });

  test("clicking Google sign-in starts the Supabase OAuth redirect", async ({
    page,
  }) => {
    await page.goto("/login");

    // The browser must leave for Google, which proves the Supabase provider is
    // configured. The full callback cannot complete locally: Google cannot reach
    // localhost, so only the hand-off is asserted.
    // waitUntil "commit", not the default "load": Google's sign-in page keeps
    // loading resources and never fires `load`, so the default times out even
    // though the hand-off succeeded.
    const navigation = page.waitForURL(
      /accounts\.google\.com|supabase\.co\/auth\/v1\/authorize/,
      { waitUntil: "commit", timeout: 30_000 },
    );

    await page
      .getByRole("main")
      .getByRole("button", { name: "Sign in with Google" })
      .click();
    await navigation;
  });

  test("password sign-in renders instead of the demo account picker", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator("#signin-password")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create one" })).toBeVisible();
  });

  test("the catalog renders live prices from the database", async ({ page }) => {
    await page.goto("/products");

    await expect(page.getByRole("heading", { name: "All products" })).toBeVisible();
    await expect(page.getByText("Everyday Cotton Tee")).toBeVisible();
    // 1800000 kobo, formatted for the NGN market.
    await expect(page.getByText(/₦18,000|NGN\s?18,000/).first()).toBeVisible();
  });

  test("a product page shows its variants and live price", async ({ page }) => {
    await page.goto("/products/heavyweight-hoodie");

    await expect(page.getByRole("heading", { name: "Heavyweight Hoodie" })).toBeVisible();
    await expect(page.getByText(/₦45,000|NGN\s?45,000/).first()).toBeVisible();
    await expect(page.getByText("Slate / L")).toBeVisible();
  });

  test("category filter narrows the live grid", async ({ page }) => {
    await page.goto("/products");

    await page.locator("#catalog-category").selectOption("Home");

    await expect(page.getByText("Ceramic Pour-Over Mug")).toBeVisible();
    await expect(page.getByText("Everyday Cotton Tee")).toHaveCount(0);
  });

  test("the tracking form is present and rejects an unknown order", async ({ page }) => {
    await page.goto("/track-order");

    await page.locator("#track-order-number").fill("LS-000000");
    await page.locator("#track-email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Find my order" }).click();

    // Must not disclose whether the order number exists.
    await expect(page.getByText("No matching order")).toBeVisible();
  });

  test("an unsigned order number cannot read an order", async ({ page }) => {
    const response = await page.goto("/checkout/success?order=LS-AAAAAA");
    expect(response?.status()).toBe(404);
  });

  test("a forged confirmation token cannot read an order", async ({ page }) => {
    const response = await page.goto("/checkout/success?token=LS-AAAAAA.deadbeef");
    expect(response?.status()).toBe(404);
  });

  test("a signed-out visitor is redirected from /account to /login", async ({
    page,
  }) => {
    await page.goto("/account");

    // proxy.ts guards /account. Being redirected is the protection: the order
    // list is never rendered for a visitor with no session.
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("redirectTo");
    await expect(
      page.getByRole("main").getByRole("button", { name: "Sign in with Google" }),
    ).toBeVisible();
  });

  test("the admin area refuses a non-admin", async ({ page }) => {
    await page.goto("/admin/orders");
    // Either the gate or a redirect to sign in; both mean the order list is not
    // rendered for an anonymous visitor.
    const denied = await page
      .getByText("Admin access required")
      .isVisible()
      .catch(() => false);
    if (!denied) {
      expect(page.url()).toContain("/login");
    }
  });

  test("no demo banner appears anywhere in the storefront", async ({ page }) => {
    for (const path of ["/", "/products", "/cart", "/account", "/checkout"]) {
      await page.goto(path);
      await expect(page.getByText(/Demo mode/i)).toHaveCount(0);
    }
  });
});