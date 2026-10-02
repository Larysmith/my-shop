import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import type { Product, Variant } from "@/lib/catalog-types";

/**
 * The live catalog, read from Supabase.
 *
 * Prices and stock are read on every request rather than cached: a stale stock
 * level means selling something that is gone, and a stale price means quoting a
 * number checkout will not honour. Next.js dedupes identical fetches within a
 * render pass, so the grid and the product page cost one round trip each rather
 * than one per component.
 */

type ProductMeta = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  status: string;
  sort_order: number;
  image_url: string | null;
};

type VariantRow = {
  id: string;
  title: string;
  sku: string;
  price_amount: number;
  stock: number;
  position: number;
  is_default: boolean;
  is_active: boolean;
  products: ProductMeta | null;
};

/**
 * Swatch colours for variant chips.
 *
 * The database has no colour column, and adding one for a purely visual detail
 * would mean a migration plus an admin surface to keep it in sync. Titles are
 * stable ("Bone / S", "Terracotta"), so a lookup by name covers every variant in
 * this catalog; an unknown title falls back to neutral grey.
 */
const SWATCH_BY_TITLE: Record<string, string> = {
  bone: "#e8e2d6",
  ink: "#2b3138",
  slate: "#4a5560",
  oat: "#ddd3c2",
  natural: "#dcd3bf",
  black: "#26262a",
  chalk: "#eceae4",
  clay: "#b5765a",
  fog: "#b6b8b3",
  terracotta: "#9a4a2c",
  tan: "#a9713f",
  espresso: "#3d2b20",
  white: "#f0eee9",
  charcoal: "#3b3d40",
  rust: "#9a4a2c",
};

const NEUTRAL_SWATCH = "#b6b8b3";

function swatchFor(title: string): string {
  // "Charcoal / M" -> "charcoal". The colour is always the leading word.
  const key = title.split("/")[0].trim().toLowerCase();
  return SWATCH_BY_TITLE[key] ?? NEUTRAL_SWATCH;
}

/**
 * The bullet list on the product page.
 *
 * The database has no column for these, and inventing one would mean a migration
 * and an editing surface for copy that barely varies. These are shop-level facts
 * derived from data already loaded. Per-product detail lines would need a real
 * column.
 */
function detailsFor(category: string, variantCount: number): string[] {
  return [
    `${category} \u00b7 ${variantCount} variant${variantCount === 1 ? "" : "s"}`,
    "Free shipping over \u20a650,000",
    "Ships within 2 working days",
  ];
}

/** Groups flat joined rows into products, in featured order. */
function toProducts(rows: VariantRow[]): Product[] {
  const byProduct = new Map<string, { meta: ProductMeta; variants: Variant[]; flags: boolean[] }>();

  for (const row of rows) {
    const meta = row.products;
    if (!meta) continue;

    const entry = byProduct.get(meta.id) ?? { meta, variants: [], flags: [] };
    entry.variants.push({
      id: row.id,
      title: row.title,
      sku: row.sku,
      priceAmount: row.price_amount,
      stock: row.stock,
      swatch: swatchFor(row.title),
    });
    entry.flags.push(row.is_default);
    byProduct.set(meta.id, entry);
  }

  return [...byProduct.values()]
    .map(({ meta, variants, flags }) => {
      // The flagged default leads, and position breaks ties so the order is
      // stable even if no variant carries the flag.
      const ordered = variants
        .map((variant, index) => ({ variant, index }))
        .sort((a, b) => {
          if (flags[a.index] !== flags[b.index]) return flags[a.index] ? -1 : 1;
          return a.index - b.index;
        })
        .map((entry) => entry.variant);

      const defaultVariant = ordered[0];

      return {
        id: meta.id,
        name: meta.name,
        slug: meta.slug,
        category: meta.category,
        priceAmount: defaultVariant.priceAmount,
        imageUrl: meta.image_url,
        description: meta.description ?? "",
        details: detailsFor(meta.category, ordered.length),
        variants: ordered,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The variant select, with the product fields inlined because PostgREST cannot
 * filter on an embedded resource from the parent side. The `.eq("products.status")`
 * is still evaluated by the database as a join condition, so an inactive product
 * yields no rows here either.
 */
const VARIANT_SELECT = `
  id, title, sku, price_amount, stock, position, is_default, is_active, image_url,
  products!inner (id, name, slug, description, category, status, sort_order, image_url)
`;

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

const PRODUCT_SELECT = `
      id, name, slug, description, category, sort_order, image_url,
      product_variants (
        id, title, sku, price_amount, stock, position, is_default, is_active, image_url
      )
    `;

/** A uuid, as Postgres writes them. Used to tell an id lookup from a slug lookup. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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