/**
 * Downloads one Pixabay photo per product into public/products/ and points
 * products.image_url at the local file.
 *
 * Dry run by default. Pass --write to download and persist.
 *
 *   npm run images:update
 *   npm run images:update -- --write
 *
 * Why local files rather than the URLs Pixabay returns:
 *
 * - The API hands back pixabay.com/get/<token>_<px>.jpg URLs. These are not
 *   stable. Repeated searches returned entirely different URL sets minutes
 *   apart, and one URL that answered 200 began answering 400 consistently.
 *   A remote URL written today can rot later with nothing to detect it.
 * - Local files also drop the runtime dependency on Pixabay, avoid hotlink and
 *   rate-limit concerns, and let next/image optimise from the original.
 *
 * Credentials are read from .env.local and never printed.
 */

import { readFileSync } from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_DIR = join(ROOT, "public", "products");

type Product = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
};

type PixabayHit = {
  webformatURL: string;
  largeImageURL?: string;
  tags?: string;
};

const PIXABAY_ENDPOINT = "https://pixabay.com/api/";

// A deliberately partial override map. Pixabay relevance on the raw product
// names returns folded-cotton textures and generic apparel rather than a
// product shot, so each query names the thing actually wanted. Anything not
// listed falls back to the product name.
const PER_PRODUCT_QUERY: Record<string, string> = {
  "everyday-cotton-tee": "plain t-shirt clothing",
  "heavyweight-hoodie": "grey hoodie clothing",
  "canvas-tote-bag": "canvas tote bag",
  "ceramic-pour-over-mug": "ceramic mug",
  "linen-throw-blanket": "linen blanket fabric",
  "leather-card-wallet": "leather wallet",
  "minimal-desk-lamp": "desk lamp",
  "merino-wool-socks": "wool socks",
};

// A 4xx or an HTML error page is not an image. Anything under this size is a
// rejected or placeholder response, not a photograph.
const MIN_IMAGE_BYTES = 20_000;

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
  if (!value || value.toLowerCase().includes("placeholder")) {
    throw new Error(`${name} is not set in .env.local`);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const env = loadEnv();
const PIXABAY_API_KEY = requireEnv(env, "PIXABAY_API_KEY");
const SUPABASE_URL = requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const SUPABASE_SERVICE_KEY = requireEnv(env, "SUPABASE_SECRET_KEY");

const WRITE = process.argv.includes("--write");
const FORCE = process.argv.includes("--force");

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
    throw new Error(
      `Could not read products: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }

  return (await response.json()) as Product[];
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

type Download =
  | { ok: true; bytes: number; data: Buffer }
  | { ok: false; reason: string };

/**
 * Fetches a candidate and confirms it is really a photograph. A 429 is
 * retried rather than treated as a bad image, because throttling says nothing
 * about the image itself. The buffer is returned so a verified image is
 * downloaded once and then written straight to disk.
 */
async function downloadImage(url: string): Promise<Download> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

      if (response.status === 429) {
        await sleep(2000 * attempt);
        continue;
      }

      if (!response.ok) {
        return { ok: false, reason: `HTTP ${response.status}` };
      }

      const type = response.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) {
        return { ok: false, reason: `not an image (${type || "no content-type"})` };
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (data.byteLength < MIN_IMAGE_BYTES) {
        return { ok: false, reason: `too small (${data.byteLength} bytes)` };
      }

      return { ok: true, bytes: data.byteLength, data };
    } catch (caught) {
      await sleep(1000 * attempt);
      if (attempt === 3) {
        return {
          ok: false,
          reason: caught instanceof Error ? caught.message : String(caught),
        };
      }
    }
  }

  return { ok: false, reason: "rate limited" };
}

async function saveLocalPath(productId: string, localPath: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`, {
    method: "PATCH",
    headers: supabaseHeaders,
    body: JSON.stringify({ image_url: localPath }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(
      `Update failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }
}

async function main(): Promise<void> {
  const products = await readProducts();

  if (WRITE) {
    await mkdir(IMAGE_DIR, { recursive: true });
  }

  const used = new Set<string>();
  const results: {
    product: Product;
    query: string;
    localPath: string;
    bytes: number | null;
    note: string;
  }[] = [];

  for (const product of products) {
    await sleep(400);

    const query = PER_PRODUCT_QUERY[product.slug] ?? product.name;
    const localPath = `/products/${product.slug}.jpg`;
    const destination = join(IMAGE_DIR, `${product.slug}.jpg`);

    let existing: number | null = null;
    try {
      existing = (await stat(destination)).size;
    } catch {
      existing = null;
    }

    // Reuse what is already downloaded unless --force, so re-running does not
    // churn images or re-hit Pixabay unnecessarily.
    if (existing && existing >= MIN_IMAGE_BYTES && !FORCE) {
      used.add(localPath);
      results.push({ product, query, localPath, bytes: existing, note: "cached" });
      console.log(`  ${product.name}\n      ${localPath}  (cached, ${existing} bytes)`);
      continue;
    }

    const hits = await searchPixabay(query);
    let chosen: { url: string; bytes: number; data: Buffer } | null = null;
    const rejected: string[] = [];

    for (const candidate of hits) {
      const url = candidate.largeImageURL ?? candidate.webformatURL;
      if (!url || used.has(url)) continue;

      const download = await downloadImage(url);
      if (!download.ok) {
        rejected.push(download.reason);
        continue;
      }

      chosen = { url, bytes: download.bytes, data: download.data };
      break;
    }

    if (!chosen) {
      console.log(
        `  [skip] ${product.name} — no usable image for "${query}"${
          rejected.length ? ` (${rejected.join(", ")})` : ""
        }`,
      );
      continue;
    }

    used.add(chosen.url);
    results.push({
      product,
      query,
      localPath,
      bytes: chosen.bytes,
      note: rejected.length ? `${rejected.length} candidate(s) rejected` : "",
    });

    console.log(`  ${product.name}`);
    console.log(`      query    "${query}" (${hits.length} hits)`);
    console.log(`      source   ${chosen.url.slice(-28)}`);
    console.log(`      local    ${localPath}  ${chosen.bytes} bytes`);

    if (WRITE) {
      await writeFile(destination, chosen.data);
    }
  }

  const ready = results.filter((r) => r.note !== "cached" || r.bytes);
  const totalBytes = ready.reduce((sum, r) => sum + (r.bytes ?? 0), 0);

  console.log(`\n${ready.length}/${products.length} products have an image.`);
  console.log(`Total download: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  if (!WRITE) {
    console.log("Dry run. Nothing was downloaded or written.");
    console.log("Re-run with --write to download to public/products/ and save the paths.");
    return;
  }

  for (const { product, localPath } of ready) {
    await saveLocalPath(product.id, localPath);
    console.log(`  [written] ${product.name} -> ${localPath}`);
  }

  console.log(`\nSaved ${ready.length} product image path(s).`);
}

main().catch((error: unknown) => {
  console.error("failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});