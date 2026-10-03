import type { Product, Variant } from "./catalog-types";
import { FREE_SHIPPING_THRESHOLD_AMOUNT, formatPriceWhole } from "./pricing";

/**
 * Row shapes and pure mapping for the catalog join.
 *
 * Split out of src/lib/server/catalog.ts because that module is `server-only`
 * and a client component has no business importing it — yet both the browser and
 * the mobile app need to turn the same PostgREST rows into the same `Product`
 * objects. Keeping one implementation means a cart line cannot render a
 * different price, swatch or variant order on the phone than on the web.
 *
 * Nothing here touches a database or the network, so it is safe to import from
 * any context.
 */

export type ProductMeta = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  status: string;
  sort_order: number;
  image_url: string | null;
};

export type VariantRow = {
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

export function swatchFor(title: string): string {
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
export function detailsFor(category: string, variantCount: number): string[] {
  return [
    `${category} · ${variantCount} variant${variantCount === 1 ? "" : "s"}`,
    `Free shipping over ${formatPriceWhole(FREE_SHIPPING_THRESHOLD_AMOUNT)}`,
    "Ships within 2 working days",
  ];
}

/** Groups flat joined rows into products, in featured order. */
export function toProducts(rows: VariantRow[]): Product[] {
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
export const VARIANT_SELECT = `
  id, title, sku, price_amount, stock, position, is_default, is_active, image_url,
  products!inner (id, name, slug, description, category, status, sort_order, image_url)
`;

export const PRODUCT_SELECT = `
      id, name, slug, description, category, sort_order, image_url,
      product_variants (
        id, title, sku, price_amount, stock, position, is_default, is_active, image_url
      )
    `;
