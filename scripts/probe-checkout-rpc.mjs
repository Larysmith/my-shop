import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Exercises create_pending_order against the reseeded catalog using the
// service role, then removes the rows it created. This is the one path that
// was previously blocked by the placeholder catalog, so it is worth proving
// the RPC accepts the new UUID variant ids and prices them in kobo.
//
// Leaves the database exactly as it found it.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, value.length - 1);
    }
    env[key] = value;
  }
  return env;
}

const env = parseEnv(await readFile(join(root, ".env.local"), "utf8"));
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const KEY = env.SUPABASE_SECRET_KEY;

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

let failures = 0;
function check(label, passed, detail) {
  if (!passed) failures += 1;
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${label}${detail ? `  ${detail}` : ""}`);
}

async function rpc(fn, body) {
  const res = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} -> HTTP ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// Two variants of the same product, which must price individually.
const variants = await (
  await fetch(
    `${BASE}/rest/v1/product_variants?select=id,title,sku,price_amount,stock,products!inner(slug)&products.slug=eq.ceramic-pour-over-mug&order=position`,
    { headers, signal: AbortSignal.timeout(20_000) },
  )
).json();

console.log("\ncreate_pending_order against the reseeded catalog\n");

check("mug has 3 variants", variants.length === 3, `got ${variants.length}`);

// The 450ml variant is the only one at a different price; the first two are
// both 1500000 kobo (Chalk and Clay at 320ml).
const small = variants[0];
const large = variants.find((v) => v.price_amount !== small.price_amount) ?? variants[2];
check(
  "variants price individually",
  small.price_amount === 1500000 && large.price_amount === 1700000,
  `${small.price_amount} / ${large.price_amount}`,
);

const order = await rpc("create_pending_order", {
  p_email: "rpc-probe@example.com",
  p_shipping: {
    name: "Probe",
    line1: "1 Test St",
    city: "Testville",
    region: "CA",
    postalCode: "90210",
    country: "US",
  },
  p_user_id: null,
  p_cart_hash: "probe-hash",
  p_lines: [
    { variantId: small.id, quantity: 2 },
    { variantId: large.id, quantity: 1 },
  ],
  p_shipping_amount: 350000,
});

check("order created", Boolean(order?.id), order?.order_number);
check(
  "order starts pending_payment",
  order?.status === "pending_payment",
  order?.status,
);

// 2 x 1500000 + 1 x 1700000 = 4700000, plus 350000 shipping = 5050000. If a
// minor-units bug were still present this would be orders of magnitude different.
check(
  "subtotal priced in kobo (4700000)",
  order?.subtotal_amount === 4700000,
  `got ${order?.subtotal_amount}`,
);
check("shipping 350000", order?.shipping_amount === 350000, `got ${order?.shipping_amount}`);
check(
  "total 5050000",
  order?.total_amount === 5050000,
  `got ${order?.total_amount}`,
);

const items = await (
  await fetch(`${BASE}/rest/v1/order_items?select=product_name,variant_title,sku,unit_price_amount,quantity,line_total_amount&order_id=eq.${order.id}`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  })
).json();

check("2 order_items written", items.length === 2, `got ${items.length}`);
check(
  "line totals correct",
  items.every((i) => i.line_total_amount === i.unit_price_amount * i.quantity),
  JSON.stringify(items.map((i) => `${i.sku}:${i.line_total_amount}`)),
);

// Stock must not move until payment is confirmed.
const afterStock = await (
  await fetch(`${BASE}/rest/v1/product_variants?select=stock&id=eq.${small.id}`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  })
).json();
check(
  "stock untouched until payment",
  afterStock[0]?.stock === small.stock,
  `${small.stock} -> ${afterStock[0]?.stock}`,
);

console.log("\nCleaning up probe rows");
await fetch(`${BASE}/rest/v1/order_items?order_id=eq.${order.id}`, { method: "DELETE", headers });
await fetch(`${BASE}/rest/v1/orders?id=eq.${order.id}`, { method: "DELETE", headers });

const gone = await (
  await fetch(`${BASE}/rest/v1/orders?id=eq.${order.id}`, { headers, signal: AbortSignal.timeout(20_000) })
).json();
check("probe order removed", gone.length === 0);

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);