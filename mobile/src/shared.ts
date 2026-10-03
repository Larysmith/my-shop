/**
 * The shop's pure modules, re-exported for the app.
 *
 * Every path crossing out of mobile/ goes through here, so the fact that the
 * phone and the website share code rather than reimplementing it is visible in
 * one place and there is exactly one set of relative paths to get right.
 *
 * Only modules with no bare imports are shared. src/lib/cart/remote.ts is not,
 * because it imports @supabase/supabase-js: resolving that from the repository's
 * node_modules would load a second copy of the client next to the app's own. The
 * Data API calls live in src/api/cart.ts instead.
 *
 * What is shared here is the part where drift would actually show — money
 * arithmetic, cart hydration, the merge rule, quantity clamping, and the cart
 * reducer — so a total or a cart line is computed the same way on both surfaces.
 */

export {
  computeTotals,
  formatPrice,
  formatPriceWhole,
  FREE_SHIPPING_THRESHOLD_AMOUNT,
  SHOP_CURRENCY,
  SHIPPING_FLAT_AMOUNT,
} from "../../../src/lib/pricing";

export {
  findVariant,
  getDefaultVariant,
  queryCatalog,
  type Product,
  type SortKey,
  type Variant,
} from "../../../src/lib/catalog-types";

export {
  detailsFor,
  swatchFor,
  toProducts,
  VARIANT_SELECT,
  type ProductMeta,
  type VariantRow,
} from "../../../src/lib/catalog-rows";

export { clampQuantity, MAX_QUANTITY } from "../../../src/lib/cart/quantity";

export {
  cartReducer,
  initialCartState,
  type AddableProduct,
  type CartAction,
  type CartState,
} from "../../../src/lib/cart/reducer";

export {
  cartRowKey,
  hydrateCartRows,
  mergeCartRows,
  toCartRows,
  type CartRow,
} from "../../../src/lib/cart/hydrate";

export type { CartLine } from "../../../src/lib/cart/types";
