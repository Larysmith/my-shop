/**
 * Sends one real email through the configured provider, using the app's own
 * transport module rather than a raw API call, so the code path under test is
 * the one that runs in production.
 *
 * This delivers a real message to MERCHANT_NOTIFICATION_EMAIL. It is meant for
 * confirming credentials and deliverability once, not for routine use.
 *
 * On a sandbox domain the recipient must already be an authorized, verified
 * recipient or the send is rejected — run `npm run check:email` first.
 */
import { readFileSync } from "node:fs";
import { register } from "node:module";

// The app source is TypeScript with extensionless relative imports, which plain
// Node cannot resolve. Reuse the test harness hooks.
register("./resolver.mjs", new URL("../tests/resolver.mjs", import.meta.url));

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { resolveProvider } = await import("../src/lib/server/email/config.ts");
const { renderEmail } = await import("../src/lib/server/email/templates.ts");

const to = process.env.MERCHANT_NOTIFICATION_EMAIL;
if (!to) {
  console.error("MERCHANT_NOTIFICATION_EMAIL is not set.");
  process.exit(1);
}

const provider = resolveProvider();
if (!provider) {
  console.error("EMAIL_PROVIDER is \"none\"; delivery is disabled.");
  process.exit(1);
}

const fromEmail = process.env[provider.fromEmailVariable];
if (!fromEmail) {
  console.error(`${provider.fromEmailVariable} is not set.`);
  process.exit(1);
}

// Reuse a real template so the rendered output matches production rather than a
// bare string, which would not catch template regressions.
const order = {
  orderNumber: "LS-TEST01",
  email: to,
  totalAmount: 5350000,
  subtotalAmount: 5000000,
  shippingAmount: 350000,
  currency: "NGN",
  shipping: {
    name: "Test Shopper",
    line1: "18 Alder Way",
    city: "Lagos",
    region: "Lagos",
    postalCode: "100001",
    country: "NG",
  },
  items: [
    {
      productName: "Heavyweight Hoodie",
      variantTitle: "Slate / M",
      sku: "LS-HEA-02-01",
      quantity: 1,
      lineTotalAmount: 4500000,
    },
    {
      productName: "Merino Wool Socks",
      variantTitle: "Charcoal / M",
      sku: "LS-MER-08-01",
      quantity: 1,
      lineTotalAmount: 500000,
    },
  ],
  trackingNumber: null,
};

const rendered = renderEmail("owner_new_order", order, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001");

console.log(`provider : ${provider.name}`);
console.log(`from     : ${provider.fromName ? `${provider.fromName} <${fromEmail}>` : fromEmail}`);
console.log(`to       : ${to}`);
console.log(`subject  : ${rendered.subject}`);

const result = await provider.sender(
  {
    from: { email: fromEmail, name: provider.fromName },
    to: { email: to },
    subject: `[test] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    tags: ["order-email", "test"],
  },
  { idempotencyKey: crypto.randomUUID() },
);

console.log(`sent     : ok (provider id ${result.providerId ?? "none returned"})`);