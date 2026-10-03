import { getSupabase } from "./supabase";
import {
  toProducts,
  VARIANT_SELECT,
  type Product,
  type ProductMeta,
  type VariantRow,
} from "../shared";

/**
 * Catalog reads for the app.
 *
 * The same query and the same mapping the website uses, so a product cannot look
 * different on the phone. Access is decided by the `products_read_active` and
 * `product_variants_read_active` policies, which already existed: an inactive
 * product or variant simply is not in the result, so no filtering is needed here.
 *
 * There is no Next.js route for this. The app carries a publishable key and RLS
 * decides what it can see, so a server hop would add a round trip without adding a
 * check.
 */

/** Every active product with at least one active variant, in featured order. */
export async function fetchCatalog(): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("is_active", true)
    .eq("products.status", "active")
    .order("position", { ascending: true });

  if (error) throw new Error(`catalog read failed: ${error.message}`);

  return toProducts((data ?? []) as unknown as VariantRow[]);
}

/** One product by slug, which is what the app's product route carries. */
export async function fetchProduct(slug: string): Promise<Product | undefined> {
  const { data, error } = await getSupabase()
    .from("products")
    .select(`
      id, name, slug, description, category, sort_order, image_url,
      product_variants (
        id, title, sku, price_amount, stock, position, is_default, is_active, image_url
      )
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`product read failed: ${error.message}`);
  if (!data) return undefined;

  const meta = data as unknown as ProductMeta;
  const rows = (
    (data as unknown as { product_variants: VariantRow[] }).product_variants ?? []
  )
    // The parent query cannot filter these, so an inactive variant is dropped here.
    .filter((row) => row.is_active)
    .map((row) => ({ ...row, products: meta }));

  if (rows.length === 0) return undefined;

  return toProducts(rows)[0];
}
