/**
 * Fills products.image_url with a Pixabay photo per product.
 *
 * Dry run by default. Pass --write to persist anything.
 *
 *   node scripts/update-product-images.ts
 *   node scripts/update-product-images.ts --write
 *
 * Notes on the choices here:
 *
 * - Uses largeImageURL (1280px) rather than webformatURL (640px). Product
 *   cards fill large containers, so the 640px original renders visibly soft.
 *
 * - Queries are PER_PRODUCT_QUERY, not the raw product name. Pixabay relevance
 *   on names like "Everyday Cotton Tee" returns folded-cotton textures and
 *   generic apparel rather than a product shot. Override per product below.
 *
 * - Picks the first hit whose URL has not already been used by another product,
 *   so two products never silently share the same photograph.
 *
 * Credentials are read from .env.local and never printed.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type Product = { id: string; name: string; slug: string; image_url: string | null };

type PixabayHit = {
  webformatURL: string;
  largeImageURL?: string;
  previewURL?: string;
  tags?: string;
};

const PIXABAY_ENDPOINT = "https://pixabay.com/api/";

// A better search term per slug. Anything not listed falls back to the product
// name, so this map is deliberately partial.
const PER_PRODUCT_QUERY: Record<string, string> = {
  "everyday-cotton-tee": "plain white t-shirt on hanger",
  "heavyweight-hoodie": "grey hoodie product photography",
  "canvas-tote-bag": "canvas tote bag",
  "ceramic-pour-over-mug": "ceramic mug minimal",
  "linen-throw-blanket": "folded linen blanket textile",
  "leather-card-wallet": "leather wallet on table",
  "minimal-desk-lamp": "minimal desk lamp",
  "merino-wool-socks": "wool socks folded",
};

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function requireEnv(env: Record<string, string>, name: string): string {
  const value = env[name];
  if (!value || value.includes("placeholder")) {
    throw new Error(`${name} is not set in .env.local`);
  }
  return value;
}

const env = loadEnv();
const PIXABAY_API_KEY = requireEnv(env, "PIXABAY_API_KEY");
const SUPABASE_URL = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const SUPABASE_SERVICE_KEY = requireEnv(env, "SUPABASE_SECRET_KEY");

const WRITE = process.argv.includes("--write");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function readProducts(): Promise<Product[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,name,slug,image_url&order=sort_order`,
    { headers: supabaseHeaders, signal: AbortSignal.timeout(20_000) },
  );

  if (!response.ok) {
    throw new Error(`Could not read products: HTTP ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as Product[];
}

// Pixabay occasionally serves a URL that resolves to 400, and separately
// rate-limits with 429. Those must not be conflated: a 429 says nothing about
// whether the image is good, so rejecting on it would discard valid candidates
// purely because the script queried too fast.
async function urlResolves(url: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        signal: AbortSignal.timeout(20_000),
      });

      if (response.status === 429) {
        await sleep(2000 * attempt);
        continue;
      }

      // 206 is the partial-content reply to the Range header above.
      return response.ok || response.status === 206;
    } catch {
      await sleep(1000 * attempt);
    }
  }

  return false;
}

async function searchPixabay(query: string): Promise<PixabayHit[]> {
  const url = new URL(PIXABAY_ENDPOINT);
  url.searchParams.set("key", PIXABAY_API_KEY);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "3");

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Pixabay returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as { hits?: PixabayHit[] };
  return body.hits ?? [];
}

async function updateImage(productId: string, imageUrl: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`,
    {
      method: "PATCH",
      headers: supabaseHeaders,
      body: JSON.stringify({ image_url: imageUrl }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Update failed: HTTP ${response.status} ${await response.text()}`);
  }
}

async function main(): Promise<void> {
  const products = await readProducts();
  const used = new Set<string>();
  const updates: { product: Product; url: string; query: string }[] = [];

  for (const product of products) {
    // Pixabay rate-limits bursts. A short pause per product keeps the image
    // checks below from being throttled into false negatives.
    await sleep(400);

    const query = PER_PRODUCT_QUERY[product.slug] ?? product.name;
    const hits = await searchPixabay(query);

    let chosen: string | null = null;
    let rejected = 0;

    // Take the first candidate that is both unused and actually reachable.
    for (const candidate of hits) {
      const url = candidate.largeImageURL ?? candidate.webformatURL;
      if (!url || used.has(url)) continue;
      if (!(await urlResolves(url))) {
        rejected += 1;
        continue;
      }
      chosen = url;
      break;
    }

    if (!chosen) {
      console.log(
        `  [skip] ${product.name} — no usable result for "${query}"${
          rejected ? ` (${rejected} unreachable)` : ""
        }`,
      );
      continue;
    }

    used.add(chosen);
    updates.push({ product, url: chosen, query });

    console.log(`  ${product.name}`);
    console.log(`      query  "${query}" (${hits.length} hits${rejected ? `, ${rejected} unreachable` : ""})`);
    console.log(`      url    ${chosen}`);
  }

  if (!WRITE) {
    console.log(`\nDry run. ${updates.length} product(s) would be updated.`);
    console.log("Re-run with --write to apply.");
    return;
  }

  for (const { product, url } of updates) {
    await updateImage(product.id, url);
    console.log(`  [written] ${product.name}`);
  }

  console.log(`\nUpdated ${updates.length} product(s).`);
}

main().catch((error: unknown) => {
  console.error("failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});