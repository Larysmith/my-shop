import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Read-only shape probe for the catalog tables. Prints column shapes and
// aggregate counts only — no customer data, no secrets.
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
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

const env = parseEnv(await readFile(join(projectRoot, ".env.local"), "utf8"));
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const key = env.SUPABASE_SECRET_KEY;

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
};

const products = await (
  await fetch(
    `${base}/rest/v1/products?select=id,name,slug,category,status,sort_order&order=slug`,
    { headers, signal: AbortSignal.timeout(20_000) },
  )
).json();

const variants = await (
  await fetch(
    `${base}/rest/v1/product_variants?select=id,product_id,title,sku,price_cents,stock,is_default,is_active,position&order=position`,
    { headers, signal: AbortSignal.timeout(20_000) },
  )
).json();

console.log(`products: ${Array.isArray(products) ? products.length : "error"}`);
console.log(`product_variants: ${Array.isArray(variants) ? variants.length : "error"}\n`);

// Which table actually carries an image column. `products.image_url` was
// dropped by 0001_schema.sql when prices moved onto variants, so image
// attribution now lives on product_variants.
for (const table of ["products", "product_variants"]) {
  const probe = await (
    await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    })
  ).json();
  const row = Array.isArray(probe) ? probe[0] : null;
  console.log(
    `${table} columns: ${row ? Object.keys(row).join(", ") : "none"}`,
  );
  console.log(`  has image_url: ${row ? "image_url" in row : false}\n`);
}

if (Array.isArray(products)) {
  for (const product of products) {
    const own = Array.isArray(variants)
      ? variants.filter((v) => v.product_id === product.id)
      : [];
    console.log(
      `${String(product.sort_order).padStart(2)}  ${product.slug.padEnd(32)} variants=${own.length}`,
    );
    for (const variant of own) {
      console.log(
        `      ${variant.title.padEnd(14)} ${variant.sku.padEnd(18)} ${String(variant.price_cents).padStart(6)}  stock=${variant.stock} default=${variant.is_default} active=${variant.is_active}`,
      );
    }
  }
}