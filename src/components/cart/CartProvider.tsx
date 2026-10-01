"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { clampQuantity, readCart, writeCart } from "@/lib/cart/storage";
import type { CartLine } from "@/lib/cart/types";
import { computeTotals } from "@/lib/pricing";

export type AddableProduct = {
  productId: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
};

type CartState = {
  lines: CartLine[];
  hydrated: boolean;
};

type CartAction =
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "add"; item: AddableProduct; quantity: number }
  | { type: "setQuantity"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" };

const initialState: CartState = { lines: [], hydrated: false };

function reducer(state: CartState, action: CartAction): CartState {
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
            ? { ...line, quantity: clampQuantity(line.quantity + action.quantity) }
            : line,
        ),
      };
    }

    case "setQuantity": {
      if (action.quantity <= 0) {
        return reducer(state, { type: "remove", productId: action.productId });
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
        lines: state.lines.filter(
          (line) => line.productId !== action.productId,
        ),
      };

    case "clear":
      return { ...state, lines: [] };
  }
}

export type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  hydrated: boolean;
  addItem: (item: AddableProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ type: "hydrate", lines: readCart() });

    function handleStorage(event: StorageEvent) {
      if (event.key !== "lary-shop.cart.v1") return;
      dispatch({ type: "hydrate", lines: readCart() });
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    writeCart(state.lines);
  }, [state.lines, state.hydrated]);

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
    };
  }, [state.lines, state.hydrated, addItem, setQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
