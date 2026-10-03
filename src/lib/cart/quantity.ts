/**
 * Quantity clamping.
 *
 * Separate from storage.ts because that module touches `window` and
 * `localStorage`, and the mobile app must be able to clamp a quantity without
 * pulling browser-only code into the bundle. The database enforces the same
 * ceiling with a check constraint on cart_items.quantity, so this value and the
 * migration cannot drift apart without one of them being wrong.
 */
export const MAX_QUANTITY = 99;

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_QUANTITY);
}
