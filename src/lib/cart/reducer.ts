import { clampQuantity } from "./quantity";
import type { CartLine } from "./types";

/**
 * The cart reducer, as a pure function.
 *
 * Extracted from src/components/cart/CartProvider.tsx so the Expo app can run the
 * identical state machine rather than a reimplementation of it. How a cart merges
 * lines has to agree across both surfaces: if the phone added a second unit of a
 * product as a new line while the website folded it into the existing one, the two
 * would reconcile into different carts and appear to disagree about the same
 * account.
 *
 * The rule, which the "add" case encodes: one line per product, and re-adding a
 * product you already hold replaces the chosen variant and sums the quantity. The
 * variant is replaced rather than kept because a shopper who picks a different
 * size means it, and keeping the old one would quote a price for something they
 * did not choose.
 */

export type AddableProduct = {
  productId: string;
  slug?: string;
  name: string;
  priceAmount: number;
  imageUrl: string | null;
  variantId?: string;
  variantTitle?: string;
  sku?: string;
};

export type CartState = {
  lines: CartLine[];
  hydrated: boolean;
};

export type CartAction =
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "add"; item: AddableProduct; quantity: number }
  | { type: "setQuantity"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" };

export const initialCartState: CartState = { lines: [], hydrated: false };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return { lines: action.lines, hydrated: true };

    case "add": {
      const existing = state.lines.find(
        (line) => line.productId === action.item.productId,
      );
      if (!existing) {
        return {
          ...state,
          lines: [
            ...state.lines,
            { ...action.item, quantity: clampQuantity(action.quantity) },
          ],
        };
      }
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.productId === action.item.productId
            ? {
                ...line,
                ...action.item,
                quantity: clampQuantity(line.quantity + action.quantity),
              }
            : line,
        ),
      };
    }

    case "setQuantity": {
      if (action.quantity <= 0) {
        return cartReducer(state, { type: "remove", productId: action.productId });
      }
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.productId === action.productId
            ? { ...line, quantity: clampQuantity(action.quantity) }
            : line,
        ),
      };
    }

    case "remove":
      return {
        ...state,
        lines: state.lines.filter((line) => line.productId !== action.productId),
      };

    case "clear":
      return { ...state, lines: [] };
  }
}
