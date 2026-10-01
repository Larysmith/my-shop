import { expect, test, type Page } from "@playwright/test";

// Walks the whole demo journey the way a person would. This is the test that
// proves the showcase actually works, rather than just compiling.

async function addFirstProduct(page: Page) {
  await page.goto("/products");
  const firstCard = page.getByRole("article").first();
  await firstCard.getByRole("button", { name: "Add to cart" }).click();
  // The count lives in the accessible name, not the rendered text.
  await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
    /Cart, 1 item/,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("guest can check out and lands on a confirmed order", async ({ page }) => {
  await addFirstProduct(page);

  await page.getByRole("link", { name: /^Cart,/ }).click();
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();

  await page.getByRole("link", { name: /Checkout/i }).first().click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  await page.getByLabel("Email").fill("shopper@example.com");
  await page.getByLabel("Full name").fill("Sam Shopper");
  await page.getByLabel("Address").fill("18 Alder Way");
  await page.getByLabel("City").fill("Portland");
  await page.getByLabel("State / region").fill("OR");
  await page.getByLabel("Postal code").fill("97209");

  await page.getByRole("button", { name: "Pay with card" }).click();

  await expect(page).toHaveURL(/\/checkout\/success\?order=LS-/);
  // This line is a <p>, not a heading, so assert on text rather than role.
  await expect(
    page.getByText(/your order is confirmed/i),
  ).toBeVisible();

  const orderNumber = new URL(page.url()).searchParams.get("order");
  expect(orderNumber).toMatch(/^LS-[A-Z0-9]{6}$/);
  await expect(page.getByText(orderNumber!, { exact: true }).first()).toBeVisible();

  // The cart must be emptied by completing the order.
  await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName(
    "Cart, empty",
  );
});

test("checkout rejects an invalid email", async ({ page }) => {
  await addFirstProduct(page);
  await page.goto("/checkout");

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Full name").fill("Sam Shopper");
  await page.getByLabel("Address").fill("18 Alder Way");
  await page.getByLabel("City").fill("Portland");
  await page.getByLabel("Postal code").fill("97209");

  await page.getByRole("button", { name: "Pay with card" }).click();

  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/);
});

test("guest can look an order up with number and email", async ({ page }) => {
  await page.goto("/track-order");

  await page.getByLabel("Order number").fill("LS-4KP2QD");
  await page.getByLabel("Email used at checkout").fill("nina@example.com");
  await page.getByRole("button", { name: "Find my order" }).click();

  await expect(page.getByText("Heavyweight Hoodie")).toBeVisible();
  await expect(page.getByText("LS-4KP2QD").first()).toBeVisible();

  // The wrong email must not reveal anything.
  await page.getByLabel("Email used at checkout").fill("wrong@example.com");
  await page.getByRole("button", { name: "Find my order" }).click();
  await expect(page.getByText("No matching order")).toBeVisible();
});

test("signing in as the owner exposes the admin fulfillment view", async ({ page }) => {
  await page.goto("/login?redirectTo=/admin");

  await page.getByRole("button", { name: /owner@lary-shop.test/ }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("cell", { name: "LS-4KP2QD" })).toBeVisible();

  // Marking an order shipped must record the transition and log two emails.
  await page.getByRole("link", { name: "LS-2VB6JH" }).click();
  // Generous timeout: in dev this route compiles on first request, which can
  // exceed the default when several workers hit dynamic routes at once.
  await expect(page.getByRole("heading", { name: "LS-2VB6JH" })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Mark shipped" }).click();
  await expect(page.getByText("has shipped").first()).toBeVisible();
  // Underscores are rendered as spaces in the email log.
  await expect(page.getByText("order shipped").first()).toBeVisible();
  await expect(page.getByText("owner shipped").first()).toBeVisible();
});

test("catalog search and category filter narrow the grid", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("article")).toHaveCount(8);

  await page.getByLabel("Filter by category").selectOption("Apparel");
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Everyday Cotton Tee" })).toBeVisible();

  await page.getByLabel("Filter by category").selectOption("all");
  await page.getByLabel("Search products").fill("hoodie");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Heavyweight Hoodie" })).toBeVisible();

  await page.getByLabel("Search products").fill("zzzz");
  await expect(page.getByText("Nothing matched that")).toBeVisible();
});

test("a buyer sees only their own order history", async ({ page }) => {
  await page.goto("/login?redirectTo=/account");
  await page.getByRole("button", { name: /nina@example.com/ }).click();

  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("link", { name: /LS-4KP2QD/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /LS-9XR7MT/ })).toBeVisible();
  // Belongs to a different buyer and must not appear.
  await expect(page.getByRole("link", { name: /LS-2VB6JH/ })).toHaveCount(0);
});

test("sold-out variants cannot be added to the cart", async ({ page }) => {
  // heavyweight-hoodie Slate / L is seeded with zero stock. The slug is used
  // rather than the p-00X demo id because slug is what survives the Postgres
  // reseed, where product ids become generated UUIDs.
  await page.goto("/products/heavyweight-hoodie");
  await page.getByRole("button", { name: /Slate \/ L/ }).click();
  // exact:true avoids also matching the variant chip "Slate / L sold out".
  await expect(
    page.getByRole("button", { name: "Sold out", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("out of stock")).toBeVisible();
});

test("the navbar reflects the demo session, and logging out clears it", async ({ page }) => {
  // The navbar resolves the demo session on the client: it is stored in
  // localStorage, so the server reports no user. This asserts that the
  // client-side fallback still swaps the login link for the user menu.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();

  await page.goto("/login");
  await page.getByRole("button", { name: /owner@lary-shop.test/ }).click();
  // The seeded owner account lands on the admin view, not the home page.
  await expect(page).toHaveURL(/\/admin$/);

  // Signed in: the account trigger replaces the login link.
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);
  // Only the owner is seeded as an admin, so the admin link must appear.
  await expect(page.getByRole("link", { name: "Admin" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();

  // Back to the signed-out layout.
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
});

