import type { Product } from "./catalog-types";
import {
  VARIANT_SELECT,
  toProducts,
  type VariantRow,
} from "./catalog-rows";
import { createClient } from "./supabase/client";

/**
 * The catalog, read from the browser.
 *
 * The pages themselves render the catalog on the server, so this exists for one
 * job: the cart. A stored cart row holds only a product id, a variant id and a
 * quantity, so drawing a line means joining the live catalog — and CartSync is a
 * client component that has no server-rendered catalog to borrow.
 *
 * Same query and same RLS as the server read, and the same mapping in
 * @/lib/catalog-rows, so a line cannot look different here than on a page.
 *
 * Errors are thrown rather than swallowed: an empty catalog and a failed catalog
 * read look identical in the UI, and silently rendering an empty cart because a
 * request failed is worse than showing an error.
 */
export async function fetchCatalog(): Promise<Product[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("is_active", true)
    .eq("products.status", "active")
    .order("position", { ascending: true });

  if (error) {
    throw new Error(`catalog read failed: ${error.message}`);
  }

  return toProducts((data ?? []) as unknown as VariantRow[]);
}
