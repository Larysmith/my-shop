import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import type { Product } from "@/lib/catalog-types";
import {
  PRODUCT_SELECT,
  VARIANT_SELECT,
  toProducts,
  type ProductMeta,
  type VariantRow,
} from "@/lib/catalog-rows";

/**
 * The live catalog, read from Supabase.
 *
 * Prices and stock are read on every request rather than cached: a stale stock
 * level means selling something that is gone, and a stale price means quoting a
 * number checkout will not honour. Next.js dedupes identical fetches within a
 * render pass, so the grid and the product page cost one round trip each rather
 * than one per component.
 *
 * The row shapes and the mapping from rows to `Product` live in
 * @/lib/catalog-rows, which is not `server-only`: the browser and the mobile app
 * map the same rows with the same code. See that file for the swatch and detail
 * derivation.
 */

/** A uuid, as Postgres writes them. Used to tell an id lookup from a slug lookup. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every active product with at least one active variant, in featured order.
 *
 * `sort_order` is not selectable through the join, so featured ordering is applied
 * by the caller through `orderProducts`, which knows the row order the database
 * returned.
 */
export async function getCatalog(): Promise<Product[]> {
  // The cookie-free client, because this also runs in generateStaticParams at
  // build time. RLS still decides visibility — see src/lib/supabase/public.ts.
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("is_active", true)
    .eq("products.status", "active")
    .order("position", { ascending: true });

  if (error) {
    console.error("catalog read failed:", error.message);
    return [];
  }

  return toProducts((data ?? []) as unknown as VariantRow[]);
}

/**
 * Resolves a product from a URL segment, which may be a slug or a uuid.
 *
 * Both are accepted on purpose. Links use the slug, but ids turn up in the wild:
 * older bookmarks, links shared before a slug change, and demo-era `p-00X` ids
 * still sitting in `localStorage`. Matching only the slug made every one of those
 * a 404.
 *
 * The uuid branch uses `.eq("id", …)` rather than a combined `.or()` filter: the
 * segment comes straight from the URL, and `or()` takes a raw filter string, so
 * a value containing a comma or parenthesis would change the meaning of the query.
 */
export async function getProduct(idOrSlug: string): Promise<Product | undefined> {
  const supabase = createPublicClient();

  // Slug first: it is the common case, and slug lookups are the ones worth hitting
  // a database index on.
  const { data: bySlug, error: slugError } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", idOrSlug)
    .eq("status", "active")
    .maybeSingle();

  if (slugError) {
    console.error(`product read failed for ${idOrSlug}:`, slugError.message);
    return undefined;
  }

  let data = bySlug;

  if (!data && UUID_RE.test(idOrSlug)) {
    const byId = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", idOrSlug)
      .eq("status", "active")
      .maybeSingle();

    if (byId.error) {
      console.error(`product read failed for id ${idOrSlug}:`, byId.error.message);
      return undefined;
    }
    data = byId.data;
  }

  if (!data) return undefined;

  const meta = data as unknown as ProductMeta;
  const rows = ((data as unknown as { product_variants: VariantRow[] }).product_variants ?? [])
    // The parent query cannot filter these, so an inactive variant is dropped here.
    .filter((row) => row.is_active)
    .map((row) => ({ ...row, products: meta }));

  if (rows.length === 0) return undefined;

  return toProducts(rows)[0];
}

/** Distinct categories for the filter, derived rather than hardcoded. */
export async function getCategories(): Promise<string[]> {
  const products = await getCatalog();
  return [...new Set(products.map((product) => product.category))].sort();
}
