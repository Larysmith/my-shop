import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { readCartRows, sameCartRows, subscribeToCart, writeCartRows } from "../api/cart";
import { fetchCatalog } from "../api/catalog";
import { getSupabase } from "../api/supabase";
import {
  cartReducer,
  computeTotals,
  createWriteQueue,
  hydrateCartRows,
  initialCartState,
  toCartRows,
  type AddableProduct,
  type CartLine,
  type CartRow,
  type Product,
  type WriteQueue,
} from "../shared";
import { useAuth } from "./useAuth";

const POLL_INTERVAL_MS = 10_000;
const WRITE_DEBOUNCE_MS = 300;
/** Coalesces the burst of events one reconcile produces into a single refetch. */
const EVENT_DEBOUNCE_MS = 150;

export type CartState = {
  lines: CartLine[];
  itemCount: number;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  /** False until the first read resolves, so the UI need not flash an empty cart. */
  ready: boolean;
  /** Set when a write was rejected and the server's version was restored instead. */
  error: string | null;
  addItem: (item: AddableProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
};

/**
 * The cart, synced with the website.
 *
 * The server is the only store. Unlike the website there is no signed-out cart
 * here: an unauthenticated visitor can browse, but adding to the cart asks them to
 * sign in, because a cart with no account behind it has nowhere to sync to and a
 * second cache to keep honest.
 *
 * Three things move data, kept separate on purpose:
 *
 *  - A realtime subscription, for the common case: something added in the browser
 *    appearing here.
 *  - Polling and a refetch on focus, for everything the socket cannot cover — a
 *    dropped connection, a backgrounded app, or a project with Realtime off, where
 *    this runs on the timer alone.
 *  - A debounced reconcile of local changes to the server.
 *
 * The echo problem is handled by `syncedRef` rather than a flag: every read records
 * the rows it just applied, so a reconcile that would re-send them compares equal
 * and sends nothing. A subscription therefore cannot loop on its own delivery.
 */
export function useCart(): CartState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productsRef = useRef<Product[] | null>(null);
  const syncedRef = useRef<CartRow[]>([]);
  const queueRef = useRef<WriteQueue<{ id: string; desired: CartRow[] }> | null>(null);

  /** Applies whatever the server currently holds. Never writes. */
  const pull = useCallback(async () => {
    if (!userId) return;
    const products = productsRef.current;
    if (!products) return;

    try {
      const rows = await readCartRows(userId);
      syncedRef.current = rows;
      dispatch({ type: "hydrate", lines: hydrateCartRows(rows, products) });
      setError(null);
    } catch (problem) {
      // Leave the screen as it is. The next poll or event retries, and emptying the
      // cart because one request failed would be worse than showing a stale one.
      console.error("cart read failed:", problem);
    }
  }, [userId]);

  /**
   * Hands the desired rows to the write queue.
   *
   * The ordering guarantee lives in createWriteQueue, shared with the website: the
   * writes are absolute upserts, so overlapping ones landing out of order would
   * leave the server holding an older cart than the shopper last chose. A phone on
   * mobile data is exactly where that happens.
   */
  const enqueue = useCallback((id: string, desired: CartRow[]) => {
    queueRef.current?.submit({ id, desired });
  }, []);

  // First load, and a fresh subscription whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let eventTimer: ReturnType<typeof setTimeout> | undefined;

    syncedRef.current = [];
    setReady(false);

    if (!userId) {
      // Signed out: nothing is stored anywhere, so show an empty cart rather than
      // the previous account's lines.
      dispatch({ type: "hydrate", lines: [] });
      setReady(true);
      return;
    }

    // Scoped to the session: a queue holding writes for one account must not
    // outlive it. `send` reads syncedRef at call time, so the closure stays fresh.
    queueRef.current = createWriteQueue<{ id: string; desired: CartRow[] }>(
      async ({ id, desired }) => {
        const current = syncedRef.current;
        if (sameCartRows(desired, current)) return;

        await writeCartRows(id, desired, current);
        syncedRef.current = desired;
        setError(null);
      },
      (problem) => {
        console.error("cart write failed:", problem);
        // The server wins. Restoring from it means the two agree again without the
        // shopper reloading, and without the two drifting apart quietly.
        setError("Could not save that change. Your cart was restored.");
        void pull();
      },
    );

    void (async () => {
      try {
        // Cached for the session: drawing any line needs the catalog, and a price
        // change between two syncs should not need two catalog reads.
        const products = (productsRef.current ??= await fetchCatalog());
        if (cancelled) return;

        const rows = await readCartRows(userId);
        if (cancelled) return;

        syncedRef.current = rows;
        dispatch({ type: "hydrate", lines: hydrateCartRows(rows, products) });
        setReady(true);

        const schedulePull = () => {
          if (eventTimer) clearTimeout(eventTimer);
          eventTimer = setTimeout(() => void pull(), EVENT_DEBOUNCE_MS);
        };

        channel = subscribeToCart(userId, schedulePull);

        pollTimer = setInterval(() => {
          void pull();
        }, POLL_INTERVAL_MS);
      } catch (problem) {
        if (cancelled) return;
        console.error("cart could not start:", problem);
        setError("Could not load your cart. Pull to try again.");
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      // Anything still queued was for this session and must not be sent after it.
      queueRef.current?.reset();
      queueRef.current = null;

      if (pollTimer) clearInterval(pollTimer);
      if (eventTimer) clearTimeout(eventTimer);
      if (channel) void getSupabase().removeChannel(channel);
    };
  }, [userId, pull]);

  // Reconciles local changes to the server.
  useEffect(() => {
    if (!userId || !ready) return;
    const products = productsRef.current;
    if (!products) return;

    const desired = toCartRows(state.lines, products);

    // Also the echo guard: after any read, the applied lines map back to exactly
    // the rows the server holds, so there is nothing to send.
    if (sameCartRows(desired, syncedRef.current)) return;

    const timer = setTimeout(() => {
      enqueue(userId, desired);
    }, WRITE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // userId is a dependency so signing out clears a pending write rather than
    // letting it fire against whichever account is signed in by then.
  }, [state.lines, userId, ready, enqueue]);

  const addItem = useCallback((item: AddableProduct, quantity = 1) => {
    dispatch({ type: "add", item, quantity });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: "setQuantity", productId, quantity });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: "remove", productId });
  }, []);

  return {
    lines: state.lines,
    itemCount: state.lines.reduce((total, line) => total + line.quantity, 0),
    ...computeTotals(state.lines),
    ready,
    error,
    addItem,
    setQuantity,
    removeItem,
  };
}
