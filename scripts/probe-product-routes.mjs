/**
 * Checks that every product is reachable at the URL the catalog links to.
 *
 * The grid links to `/products/<id>`, and in production that id is a UUID while
 * the PDP resolves by slug. If the server lookup only matches the slug column,
 * every card click 404s — which is exactly the symptom this script was written to
 * chase down. It fetches the live ids and slugs, then reports whether both forms
 * of URL resolve, using the running dev server.
 *
 *   node scripts/probe-product-routes.mjs [baseUrl]
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://localhost:3001";

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

const env = parseEnv(await readFile(join(ROOT, ".env.local"), "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

const response = await fetch(`${url}/rest/v1/products?select=id,slug&order=sort_order`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

if (!response.ok) {
  console.error(`products query failed: HTTP ${response.status}`);
  process.exit(1);
}

const products = await response.json();
let failures = 0;

for (const product of products) {
  const results = [];
  for (const [label, path] of [
    ["id  ", product.id],
    ["slug", product.slug],
  ]) {
    let status = 0;
    try {
      status = (await fetch(`${BASE}/products/${path}`, { redirect: "manual" })).status;
    } catch {
      // Unreachable dev server: report it as 0 rather than throwing, so one bad
      // product does not hide the rest of the table.
      status = 0;
    }
    results.push(`${label}=${status}`);
    if (status !== 200) failures += 1;
  }
  console.log(`  ${results.join("  ")}  ${product.slug}`);
}

console.log(
  failures === 0
    ? `\nAll ${products.length} products resolve by both id and slug.`
    : `\n${failures} product URL(s) did not return 200.`,
);
process.exit(failures === 0 ? 0 : 1);
