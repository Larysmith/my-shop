/**
 * Prints products.image_url as stored in the live database.
 *
 * Read-only, with no secrets printed, so it is safe to run at any time. Used to
 * confirm that the rows point at the local files in public/products rather than at
 * the short-lived Pixabay URLs the reseed script originally wrote.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = parseEnv(await readFile(join(projectRoot, ".env.local"), "utf8"));

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and a secret key are required in .env.local");
  process.exit(1);
}

const response = await fetch(`${url}/rest/v1/products?select=slug,name,image_url&order=slug`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
});

if (!response.ok) {
  console.error(`products query failed: HTTP ${response.status} ${await response.text()}`);
  process.exit(1);
}

const products = await response.json();
const local = products.filter((p) => (p.image_url ?? "").startsWith("/products/"));
const remote = products.filter((p) => p.image_url && !p.image_url.startsWith("/products/"));
const missing = products.filter((p) => !p.image_url);

console.log(`products: ${products.length}`);
console.log(`  local /products/ paths: ${local.length}`);
console.log(`  remote URLs:             ${remote.length}`);
console.log(`  null:                    ${missing.length}`);

for (const product of products) {
  console.log(`  ${product.slug.padEnd(24)} ${product.image_url ?? "(null)"}`);
}

// Variants carry their own image_url, and the product detail page may render that
// instead of the product-level one. A reseed rewrites both, so check both.
const variantsResponse = await fetch(
  `${url}/rest/v1/product_variants?select=id,image_url&order=id`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);

if (variantsResponse.ok) {
  const variants = await variantsResponse.json();
  const remoteVariants = variants.filter(
    (v) => v.image_url && !v.image_url.startsWith("/products/"),
  );

  console.log(`\nvariants: ${variants.length}`);
  console.log(`  non-local image_url: ${remoteVariants.length}`);
  for (const variant of remoteVariants.slice(0, 10)) {
    console.log(`  ${variant.id.slice(0, 8)}  ${variant.image_url}`);
  }
} else {
  console.log(`\nvariants query failed: HTTP ${variantsResponse.status}`);
}