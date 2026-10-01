import "server-only";

import { catalog as demoCatalog } from "@/lib/catalog";
import { DEMO_MODE } from "@/lib/demo/types";
import type { Product } from "@/lib/catalog-types";
import { getCatalog, getProductBySlug } from "@/lib/server/catalog";

/**
 * One entry point for catalog reads, whichever mode the app is in.
 *
 * Every page calls these instead of importing `@/lib/catalog` directly. That is
 * the whole point: a page that imports the demo file can never show live data,
 * and a page that imports the server module crashes in demo mode because
 * `server-only` throws outside a server context. Routing through one function
 * means the mode decision lives in exactly one place.
 *
 * A catalog read is cheap and always fresh — a cached price or stock level is a
 * real bug — so this is not cached. Next.js dedupes identical fetches within a
 * single render pass.
 */

export async function loadCatalog(): Promise<Product[]> {
  if (DEMO_MODE) return demoCatalog;
  return getCatalog();
}

export async function loadProduct(slug: string): Promise<Product | undefined> {
  if (DEMO_MODE) {
    return demoCatalog.find((product) => product.slug === slug || product.id === slug);
  }
  return getProductBySlug(slug);
}

export async function loadCategories(): Promise<string[]> {
  if (DEMO_MODE) {
    return [...new Set(demoCatalog.map((product) => product.category))].sort();
  }
  const products = await getCatalog();
  return [...new Set(products.map((product) => product.category))].sort();
}

/** Slugs for static generation. Empty in demo mode, where routes are prerendered. */
export async function loadCatalogSlugs(): Promise<string[]> {
  const products = await loadCatalog();
  return products.map((product) => product.slug);
}