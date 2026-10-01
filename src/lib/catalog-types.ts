/**
 * Catalog types and pure helpers.
 *
 * Deliberately free of any data source: these types are what the UI renders, and
 * both the demo catalog and the Supabase read produce them. Keeping the shape
 * here means a page component never has to know where a product came from.
 *
 * Money is integer kobo. See `@/lib/pricing`.
 */

export type Variant = {
  id: string;
  title: string;
  sku: string;
  priceAmount: number;
  stock: number;
  /** Palette colour for the variant chip. Presentational only. */
  swatch: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  /** The default variant's price, so a product reads as one priced thing. */
  priceAmount: number;
  imageUrl: string | null;
  description: string;
  details: string[];
  variants: Variant[];
};

export function getDefaultVariant(product: Product): Variant {
  return product.variants[0];
}

export function findVariant(
  products: Product[],
  variantId: string,
): { product: Product; variant: Variant } | undefined {
  for (const product of products) {
    const found = product.variants.find((v) => v.id === variantId);
    if (found) return { product, variant: found };
  }
  return undefined;
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "name";

/**
 * Filters and sorts an already-loaded list.
 *
 * Runs in the browser on data fetched once, which is what the catalog grid wants:
 * typing in the search box must not cost a round trip. `featured` is the stored
 * order, so it must not sort — hence the empty default branch.
 */
export function queryCatalog(
  products: Product[],
  {
    q = "",
    category = "all",
    sort = "featured",
  }: {
    q?: string;
    category?: string;
    sort?: SortKey;
  },
): Product[] {
  const needle = q.trim().toLowerCase();

  const filtered = products.filter((product) => {
    if (category !== "all" && product.category !== category) return false;
    if (!needle) return true;
    return (
      product.name.toLowerCase().includes(needle) ||
      product.description.toLowerCase().includes(needle) ||
      product.category.toLowerCase().includes(needle)
    );
  });

  const sorted = [...filtered];
  switch (sort) {
    case "price-asc":
      sorted.sort((a, b) => a.priceAmount - b.priceAmount);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.priceAmount - a.priceAmount);
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      break;
  }
  return sorted;
}