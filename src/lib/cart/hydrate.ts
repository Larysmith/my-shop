import { findVariant, getDefaultVariant, type Product } from "../catalog-types";
import { clampQuantity } from "./quantity";
import type { CartLine } from "./types";

/**
 * Translating between the cart as it is stored (cart_items) and the cart as it is
 * rendered (CartLine).
 *
 * The stored form is deliberately impoverished: a product id, a variant id and a
 * quantity. No price, name or image, because those are read from the catalog at
 * render time on both the web and the mobile client. That is what stops a price
 * change from going stale in someone's cart, and it means no client-supplied
 * amount ever has to be trusted.
 *
 * Pure and free of any data source, so the mobile app can import it directly and
 * stay numerically identical to the web app.
 */

/** A row of `cart_items`, in the shape the Data API returns it. */
export type CartRow = {
  productId: string;
  variantId: string;
  quantity: number;
};

/**
 * Resolves stored rows into renderable lines against the live catalog.
 *
 * A row whose variant is gone is dropped rather than rendered as a placeholder.
 * That is the common case, not an edge case: `product_variants_read_active`
 * filters deactivated variants out of the catalog read, so a variant an admin
 * switched off disappears from the join and leaves its row unresolvable. The
 * alternative — showing "no longer available" — needs a tombstone shape in
 * CartLine and a UI state for it, for a line the shopper cannot buy anyway.
 */
export function hydrateCartRows(rows: CartRow[], products: Product[]): CartLine[] {
  const lines: CartLine[] = [];

  for (const row of rows) {
    const found = findVariant(products, row.variantId);
    if (!found) continue;

    const { product, variant } = found;
    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      priceAmount: variant.priceAmount,
      imageUrl: product.imageUrl,
      variantId: variant.id,
      variantTitle: variant.title,
      sku: variant.sku,
      quantity: clampQuantity(row.quantity),
    });
  }

  return lines;
}

/**
 * The inverse: renderable lines back to rows, ready to be written.
 *
 * A line with no variantId falls back to the product's default variant, which is
 * what a line added before a variant was ever chosen looks like. Lines whose
 * product is not in `products` are dropped rather than written, so an unresolvable
 * reference is never persisted.
 */
export function toCartRows(lines: CartLine[], products: Product[]): CartRow[] {
  const rows: CartRow[] = [];

  for (const line of lines) {
    const product = products.find((candidate) => candidate.id === line.productId);
    if (!product) continue;

    const variant =
      (line.variantId
        ? product.variants.find((candidate) => candidate.id === line.variantId)
        : undefined) ?? getDefaultVariant(product);

    rows.push({
      productId: product.id,
      variantId: variant.id,
      quantity: clampQuantity(line.quantity),
    });
  }

  return rows;
}

/**
 * Combines the cart held on this device with the cart already on the account,
 * for the moment a visitor signs in and a local cart starts syncing.
 *
 * Union per product, not a replace: signing in must not silently discard a cart
 * the shopper just built. Quantities are summed because the cart holds one line
 * per product. On a variant collision the device cart wins, which matches the
 * reducer's rule that re-adding a product adopts the newly chosen variant — the
 * newer intent is the one the shopper is looking at.
 */
export function mergeCartRows(
  local: CartLine[],
  server: CartRow[],
  products: Product[],
): CartRow[] {
  const byProduct = new Map<string, CartRow>();

  for (const row of server) {
    byProduct.set(row.productId, { ...row, quantity: clampQuantity(row.quantity) });
  }

  for (const row of toCartRows(local, products)) {
    const existing = byProduct.get(row.productId);
    byProduct.set(
      row.productId,
      existing
        ? {
            productId: row.productId,
            variantId: row.variantId,
            quantity: clampQuantity(existing.quantity + row.quantity),
          }
        : row,
    );
  }

  return [...byProduct.values()];
}

/** Stable key for comparing a desired cart against what the server last returned. */
export function cartRowKey(row: CartRow): string {
  return `${row.productId}:${row.variantId}:${row.quantity}`;
}
