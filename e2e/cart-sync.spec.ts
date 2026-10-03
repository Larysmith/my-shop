import { expect, test, type Page } from "@playwright/test";

/**
 * The cart syncing between two clients, which is the same mechanism the mobile app
 * uses: a write on one surface reaching the other through Realtime.
 *
 * Two browser contexts standing in for "web" and "phone". Realtime cannot tell a
 * phone from a second tab, so if these two converge, the Expo app will too once it
 * is pointed at the same project — the only difference between them is who draws
 * the screen.
 *
 * Credentials come from the environment and the suite skips without them. It never
 * signs up: that would create a real account in the live database as a side effect
 * of running the tests. Set these to run it:
 *
 *   E2E_EMAIL=you@example.com E2E_EMAIL_PASSWORD=... npm run test:e2e
 *
 * Migrations 0009-0011 must be applied first. Without cart_items the first
 * assertion fails rather than skipping, which is the correct signal.
 *
 * Serial, and each test empties the cart first, because all of them share one
 * account and therefore one cart.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_EMAIL_PASSWORD;

const CART_LINK = /^Cart,/;

test.describe("cart sync between two clients", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Set E2E_EMAIL and E2E_EMAIL_PASSWORD to run the cart sync suite.",
  );

  test.describe.configure({ mode: "serial" });

  async function signIn(page: Page) {
    await page.goto("/login");
    await page.locator("#signin-email").fill(EMAIL as string);
    await page.locator("#signin-password").fill(PASSWORD as string);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 30_000,
    });
  }

  /** Empties the account cart through the UI, so each test starts from zero. */
  async function emptyCart(page: Page) {
    await page.goto("/cart");
    await expect(
      page.getByRole("main").getByRole("listitem").or(page.getByText("Your cart is empty")),
    ).toBeVisible({ timeout: 20_000 });

    for (let removed = await page.getByRole("button", { name: "Remove" }).count(); removed > 0; removed -= 1) {
      await page.getByRole("button", { name: "Remove" }).first().click();
      await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(removed - 1, {
        timeout: 15_000,
      });
    }
  }

  test("a line added in one client appears in the other", async ({ browser }) => {
    const web = await browser.newContext();
    const phone = await browser.newContext();

    try {
      const webPage = await web.newPage();
      const phonePage = await phone.newPage();

      await signIn(webPage);
      await signIn(phonePage);
      await emptyCart(webPage);

      await webPage.goto("/products/everyday-cotton-tee");
      await webPage.getByRole("button", { name: "Add to cart" }).first().click();
      await expect(webPage.getByRole("link", { name: CART_LINK })).toHaveAccessibleName(
        /Cart, 1 item/,
      );

      // The other client is on the catalog and was never touched. The line has to
      // arrive on its own, which is the entire claim.
      await phonePage.goto("/products");
      await expect(phonePage.getByRole("link", { name: CART_LINK })).toHaveAccessibleName(
        /Cart, 1 item/,
        { timeout: 20_000 },
      );

      await phonePage.goto("/cart");
      await expect(phonePage.getByText("Everyday Cotton Tee")).toBeVisible();
    } finally {
      await web.close();
      await phone.close();
    }
  });

  test("a quantity changed in one client is reflected in the other", async ({
    browser,
  }) => {
    const web = await browser.newContext();
    const phone = await browser.newContext();

    try {
      const webPage = await web.newPage();
      const phonePage = await phone.newPage();

      await signIn(webPage);
      await signIn(phonePage);
      await emptyCart(webPage);

      // Two different products, so the assertion is about a specific line moving
      // rather than a total happening to change.
      await webPage.goto("/products/everyday-cotton-tee");
      await webPage.getByRole("button", { name: "Add to cart" }).first().click();
      await webPage.goto("/products/heavyweight-hoodie");
      await webPage.getByRole("button", { name: "Add to cart" }).first().click();

      await phonePage.goto("/cart");
      await expect(phonePage.getByRole("main").getByRole("listitem")).toHaveCount(2, {
        timeout: 20_000,
      });

      const firstLine = phonePage.getByRole("main").getByRole("spinbutton").first();
      await expect(firstLine).toHaveValue("1");
      await firstLine.fill("3");
      await firstLine.blur();

      // The web side must reach 3 on that same line, not merely show a bigger total.
      await expect(
        webPage.getByRole("main").getByRole("spinbutton").first(),
      ).toHaveValue("3", { timeout: 20_000 });
    } finally {
      await web.close();
      await phone.close();
    }
  });

  test("a removal in one client is reflected in the other", async ({ browser }) => {
    const web = await browser.newContext();
    const phone = await browser.newContext();

    try {
      const webPage = await web.newPage();
      const phonePage = await phone.newPage();

      await signIn(webPage);
      await signIn(phonePage);
      await emptyCart(webPage);

      await webPage.goto("/products/everyday-cotton-tee");
      await webPage.getByRole("button", { name: "Add to cart" }).first().click();
      await webPage.goto("/cart");
      await expect(webPage.getByRole("main").getByRole("listitem")).toHaveCount(1);

      await phonePage.goto("/cart");
      await expect(phonePage.getByRole("main").getByRole("listitem")).toHaveCount(1, {
        timeout: 20_000,
      });

      await phonePage.getByRole("button", { name: "Remove" }).click();

      // Deletion has to travel as readily as an insert, or a cart can be emptied on
      // one surface and still hold a line on the other.
      await expect(webPage.getByRole("main").getByRole("listitem")).toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(webPage.getByText("Your cart is empty")).toBeVisible();
    } finally {
      await web.close();
      await phone.close();
    }
  });

  test("a signed-in cart survives signing out and back in", async ({ browser }) => {
    // The distinction between "synced" and "cached in two places": if the line is
    // still here after the session and the device cache are both gone, it came
    // from the server.
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      await signIn(page);
      await emptyCart(page);

      await page.goto("/products/canvas-tote-bag");
      await page.getByRole("button", { name: "Add to cart" }).first().click();
      await expect(page.getByRole("link", { name: CART_LINK })).toHaveAccessibleName(
        /Cart, 1 item/,
      );

      await page.goto("/account");
      await page.getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/account"), {
        timeout: 30_000,
      });

      // The sign-in merge must not have folded the account cart into a guest cart,
      // and signing back in must read the server rather than a leftover cache.
      await signIn(page);
      await page.goto("/cart");
      await expect(page.getByText("Canvas Tote Bag")).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });
});
