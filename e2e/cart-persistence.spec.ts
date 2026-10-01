import { expect, test, type Page } from "@playwright/test";

const CART_LINK = /^Cart,/;

function cartLink(page: Page) {
  return page.getByRole("link", { name: CART_LINK });
}

function card(page: Page, index: number) {
  return page.getByRole("article").nth(index);
}

async function addToCart(page: Page, cardIndex: number, expectedTotal: number) {
  const button = card(page, cardIndex).getByRole("button");

  await expect(async () => {
    await expect(button).toHaveAccessibleName("Add to cart");
    await button.click();
    await expect(cartLink(page)).toHaveAccessibleName(
      new RegExp(`Cart, ${expectedTotal} item`),
    );
  }).toPass({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
});

test("cart survives a full page reload", async ({ page }) => {
  await addToCart(page, 0, 1);
  await addToCart(page, 1, 2);
  await addToCart(page, 1, 3);

  await expect(cartLink(page)).toHaveAccessibleName("Cart, 3 items");

  const stored = await page.evaluate(() =>
    window.localStorage.getItem("lary-shop.cart.v1"),
  );
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored as string);
  expect(parsed.version).toBe(1);
  expect(parsed.lines).toHaveLength(2);
  expect(parsed.lines.map((line: { quantity: number }) => line.quantity)).toEqual([
    1, 2,
  ]);

  await page.reload();
  await page.waitForLoadState("networkidle");

  await expect(cartLink(page)).toHaveAccessibleName("Cart, 3 items");

  await page.goto("/cart");
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(2);

  const quantities = await page
    .getByRole("main")
    .getByRole("spinbutton")
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  expect(quantities).toEqual(["1", "2"]);

  await expect(page.getByText("3 items")).toBeVisible();
});

test("adding the same product twice merges into one line", async ({ page }) => {
  await addToCart(page, 0, 1);
  await addToCart(page, 0, 2);

  await page.goto("/cart");
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("spinbutton")).toHaveValue("2");
});

test("removing the last line returns the cart to its empty state", async ({
  page,
}) => {
  await addToCart(page, 0, 1);

  await page.goto("/cart");
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Remove" }).click();

  await expect(page.getByText("Your cart is empty")).toBeVisible();
  await expect(cartLink(page)).toHaveAccessibleName("Cart, empty");
});
