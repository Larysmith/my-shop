"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  cartReducer,
  initialCartState,
  type AddableProduct,
} from "@/lib/cart/reducer";
import type { CartLine } from "@/lib/cart/types";
import { computeTotals } from "@/lib/pricing";

export type { AddableProduct } from "@/lib/cart/reducer";

export type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  hydrated: boolean;
  addItem: (item: AddableProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  /**
   * Replaces the whole cart from an outside source, and marks it hydrated.
   *
   * Used by CartSync for every read that is not a user action: the first load,
   * the merge that runs on sign-in, and each realtime event. `hydrated` flips
   * here rather than at mount so the "Loading your cart…" placeholder stays up
   * until there is something real to show.
   */
  replaceAll: (lines: CartLine[]) => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

/**
 * Pure cart state: a reducer and the totals derived from it. No I/O.
 *
 * All persistence and synchronisation lives in CartSync. That split exists
 * because this provider is mounted above AuthProvider in the root layout, so it
 * cannot know whether the visitor is signed in — and that answer decides whether
 * the cart is stored in localStorage or on the server. Keeping the I/O in a
 * component that can see both contexts means the reducer stays trivially
 * testable and the choice of storage lives in one file.
 *
 * The reducer itself is in @/lib/cart/reducer rather than here, because the mobile
 * app runs the same state machine and both surfaces must merge a repeated add the
 * same way.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  const addItem = useCallback(
    (item: AddableProduct, quantity = 1) => {
      dispatch({ type: "add", item, quantity });
    },
    [],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: "setQuantity", productId, quantity });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: "remove", productId });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const replaceAll = useCallback((lines: CartLine[]) => {
    dispatch({ type: "hydrate", lines });
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const totals = computeTotals(state.lines);
    return {
      lines: state.lines,
      itemCount: state.lines.reduce(
        (total, line) => total + line.quantity,
        0,
      ),
      ...totals,
      hydrated: state.hydrated,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      replaceAll,
    };
  }, [state.lines, state.hydrated, addItem, setQuantity, removeItem, clearCart, replaceAll]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
