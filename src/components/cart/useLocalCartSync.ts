"use client";

import { useEffect, useRef } from "react";
import { readCart, writeCart } from "@/lib/cart/storage";
import { useCart } from "./useCart";

/**
 * The cart as it is stored when nobody is signed in, and in demo mode.
 *
 * Read once on entry into local mode, written on every change. This is the
 * behaviour the shop had before the cart moved to the database, unchanged, which
 * is what keeps guest checkout and the whole demo-mode suite working with no
 * server involved.
 */
export function useLocalCartSync(active: boolean) {
  const { lines, replaceAll } = useCart();
  const awaitingHydrateRef = useRef(false);

  useEffect(() => {
    if (!active) {
      awaitingHydrateRef.current = false;
      return;
    }

    // Set before dispatching, because the persist effect below runs in this same
    // commit and would otherwise write the still-empty pre-hydration state over
    // the cart it is in the middle of loading.
    awaitingHydrateRef.current = true;
    replaceAll(readCart());
  }, [active, replaceAll]);

  useEffect(() => {
    if (!active) return;

    // The lines arriving from this commit are the ones that were just read out of
    // storage. Persisting them would be a no-op at best; if they have not arrived
    // yet it would erase the cart. Skip either way and persist on the next change.
    if (awaitingHydrateRef.current) {
      awaitingHydrateRef.current = false;
      return;
    }

    writeCart(lines);
  }, [active, lines]);
}
