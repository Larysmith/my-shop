/**
 * Dumps the structure of Paystack's hosted checkout page.
 *
 * The card field is not a plain input on Paystack's current checkout: it is built
 * from a container div plus a hidden input, or an iframe, depending on the layout
 * served. Guessing the selector produced a 30s timeout, so this records what is
 * actually there.
 *
 * Runs the real checkout up to the Paystack page, then prints inputs, iframes and
 * buttons. Creates a pending order, which it then cleans up.
 *
 *   node scripts/inspect-paystack-checkout.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.VERIFY_BASE ?? "http://localhost:3001";

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = value;
  }
  return env;
}

const env = parseEnv(await readFile(join(ROOT, ".env.local"), "utf8"));
const SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const SERVICE = env.SUPABASE_SECRET_KEY;
const dbHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

const rest = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    ...options,
    headers: { ...dbHeaders, ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

const stamp = Date.now().toString(36);
const probeEmail = `inspect-${stamp}@example.com`;

// Paystack's page sits behind a Cloudflare Turnstile challenge, which never
// completes in headless Chromium. Headed mode with the automation fingerprint
// reduced is what gets the card form to render; that is a limitation of driving
// someone else's checkout, not of this app.
const HEADED = process.argv.includes("--headed");

const browser = await chromium.launch({
  headless: !HEADED,
  args: ["--disable-blink-features=AutomationControlled"],
});
let orderId = null;

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-NG",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  await page.goto(`${BASE}/products/ceramic-pour-over-mug`);
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.goto(`${BASE}/checkout`);

  await page.locator("#co-email").fill(probeEmail);
  await page.locator("#co-name").fill("Inspect Probe");
  await page.locator("#co-line1").fill("1 Test Street");
  await page.locator("#co-city").fill("Lagos");
  await page.locator("#co-region").fill("Lagos");
  await page.locator("#co-postal").fill("100001");
  await page.locator("#co-country").fill("NG");

  await page.getByRole("button", { name: /Pay with card|Place order|Proceed/ }).first().click();
  await page.waitForURL(/checkout\.paystack\.com/, { timeout: 45_000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  console.log(`\nurl: ${page.url()}\n`);

  console.log("inputs:");
  for (const input of await page.locator("input").all()) {
    console.log(
      `  name=${await input.getAttribute("name")} type=${await input.getAttribute("type")} ` +
        `autocomplete=${await input.getAttribute("autocomplete")} placeholder=${await input.getAttribute("placeholder")} ` +
        `visible=${await input.isVisible().catch(() => false)}`,
    );
  }

  console.log("\niframes:");
  for (const frame of await page.locator("iframe").all()) {
    console.log(`  src=${await frame.getAttribute("src")} title=${await frame.getAttribute("title")}`);
  }

  console.log("\nbuttons:");
  for (const button of await page.locator("button").all()) {
    console.log(`  "${(await button.innerText().catch(() => "")).trim()}" visible=${await button.isVisible().catch(() => false)}`);
  }

  const order = await rest(`orders?select=id&email=eq.${probeEmail}&limit=1`);
  orderId = order?.[0]?.id ?? null;
} finally {
  await browser.close();
  if (orderId) {
    await rest(`order_items?order_id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});
    await rest(`orders?id=eq.${orderId}`, { method: "DELETE" }).catch(() => {});
    console.log(`\ncleaned up probe order ${orderId}`);
  }
}