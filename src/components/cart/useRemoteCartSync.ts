"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { readCart, writeCart } from "@/lib/cart/storage";
import {
  hydrateCartRows,
  mergeCartRows,
  toCartRows,
  type CartRow,
} from "@/lib/cart/hydrate";
import {
  readCartRows,
  sameCartRows,
  subscribeToCart,
  writeCartRows,
} from "@/lib/cart/remote";
import { fetchCatalog } from "@/lib/catalog-client";
import type { Product } from "@/lib/catalog-types";
import { createClient } from "@/lib/supabase/client";
import { createWriteQueue, type WriteQueue } from "@/lib/cart/write-queue";
import { useCart } from "./useCart";

const POLL_INTERVAL_MS = 10_000;
const WRITE_DEBOUNCE_MS = 300;
/** Coalesces the burst of events one reconcile produces into a single refetch. */
const EVENT_DEBOUNCE_MS = 150;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Keeps the signed-in cart on the server and the cart on screen in agreement.
 *
 * Three things move data, and they are deliberately kept separate:
 *
 *  - A realtime subscription for the common case, which is a write on the phone
 *    and the line appearing on the web.
 *  - Polling and a refetch on window focus, for everything the socket cannot
 *    cover: a dropped connection, a suspended tab, or a project with Realtime
 *    switched off, where this hook simply runs on the timer alone.
 *  - A debounced reconcile of local changes to the server.
 *
 * The echo problem is solved by `syncedRef` rather than a flag. Every read — the
 * first load, a realtime event, a poll — records the rows it just applied, so a
 * reconcile that would re-send them compares equal and sends nothing. No
 * bookkeeping to get wrong, and no way for a subscription to loop on its own
 * delivery.
 */
export function useRemoteCartSync(userId: string | null) {
  const { lines, replaceAll } = useCart();
  const productsRef = useRef<Product[] | null>(null);
  const syncedRef = useRef<CartRow[]>([]);
  const readyRef = useRef(false);
  const userRef = useRef<string | null>(null);
  const queueRef = useRef<WriteQueue<{ id: string; desired: CartRow[] }> | null>(null);

  /** Applies whatever the server currently holds. Never writes. */
  const pull = useCallback(async () => {
    const id = userRef.current;
    const products = productsRef.current;
    if (!id || !products) return;

    try {
      const rows = await readCartRows(createClient(), id);
      syncedRef.current = rows;
      replaceAll(hydrateCartRows(rows, products));
    } catch (error) {
      // Leave the screen as it is. The next poll or event retries, and showing an
      // empty cart because one request failed would be worse than a stale one.
      console.error("cart sync read failed:", messageOf(error));
    }
  }, [replaceAll]);

  /**
   * Writes the desired rows, one at a time.
   *
   * The ordering guarantee lives in createWriteQueue, and the reason it is needed
   * is documented there: the writes are absolute upserts, so overlapping ones
   * landing out of order would leave the server holding an older cart than the
   * shopper last asked for, and the next poll would adopt that older cart as the
   * truth.
   *
   * What this adds is the diff. `current` is read at write time rather than when
   * the debounce was scheduled, because a write that landed in the meantime has
   * already updated what the server holds — comparing against the older snapshot
   * would re-send rows that are already correct.
   */
  const enqueue = useCallback(
    (id: string, desired: CartRow[]) => {
      queueRef.current?.submit({ id, desired });
    },
    [],
  );

  // Initialisation, re-run whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let eventTimer: ReturnType<typeof setTimeout> | undefined;
    let onVisible: (() => void) | undefined;
    let onFocus: (() => void) | undefined;

    readyRef.current = false;
    userRef.current = userId;

    if (!userId) {
      syncedRef.current = [];
      return;
    }

    // Created here rather than at the top of the hook so its lifetime matches the
    // signed-in session: a queue holding writes for one account must not outlive
    // it. `send` reads syncedRef and userRef at call time, so the closure never
    // goes stale, and `pull` is stable for the life of the component.
    queueRef.current = createWriteQueue<{ id: string; desired: CartRow[] }>(
      async ({ id, desired }) => {
        const current = syncedRef.current;
        if (sameCartRows(desired, current)) return;

        await writeCartRows(createClient(), id, desired, current);
        syncedRef.current = desired;
      },
      (error) => {
        console.error("cart sync write failed:", messageOf(error));
        // The server wins. Refetching restores agreement without the shopper
        // having to reload, and without local and remote drifting apart.
        void pull();
      },
    );

    async function start() {
      try {
        // Cached for the session: the cart needs the catalog to render a line, and
        // a price change between two syncs should not need two catalog reads.
        const products = (productsRef.current ??= await fetchCatalog());
        if (cancelled) return;

        const supabase = createClient();
        const serverRows = await readCartRows(supabase, userId as string);
        if (cancelled) return;

        // The merge for a visitor who built a cart before signing in. A cart that
        // only exists on the server is left alone.
        const local = readCart();
        let rows = serverRows;

        if (local.length > 0) {
          rows = mergeCartRows(local, serverRows, products);
          await writeCartRows(supabase, userId as string, rows, serverRows);
          if (cancelled) return;

          // Cleared so signing out again does not resurrect the merged cart as a
          // guest cart on this device.
          writeCart([]);
        }

        syncedRef.current = rows;
        readyRef.current = true;
        replaceAll(hydrateCartRows(rows, products));

        const schedulePull = () => {
          if (eventTimer) clearTimeout(eventTimer);
          eventTimer = setTimeout(() => void pull(), EVENT_DEBOUNCE_MS);
        };

        channel = subscribeToCart(supabase, userId as string, schedulePull);

        pollTimer = setInterval(() => {
          if (document.visibilityState === "visible") void pull();
        }, POLL_INTERVAL_MS);

        onVisible = () => {
          if (document.visibilityState === "visible") void pull();
        };
        onFocus = onVisible;

        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onFocus);
      } catch (error) {
        console.error("cart sync could not start:", messageOf(error));
      }
    }

    void start();

    return () => {
      cancelled = true;
      readyRef.current = false;
      userRef.current = null;
      syncedRef.current = [];

      // Anything still queued was for this session and must not be sent after it.
      queueRef.current?.reset();
      queueRef.current = null;

      if (pollTimer) clearInterval(pollTimer);
      if (eventTimer) clearTimeout(eventTimer);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
      if (onFocus) window.removeEventListener("focus", onFocus);
      if (channel) void createClient().removeChannel(channel);
    };
  }, [userId, pull, replaceAll]);

  // Reconciles local changes to the server.
  useEffect(() => {
    const id = userRef.current;
    const products = productsRef.current;
    if (!readyRef.current || !id || !products) return;

    const desired = toCartRows(lines, products);

    // The echo guard: after any read, the applied lines map back to exactly the
    // rows the server holds, so there is nothing to send. Worth checking before
    // the debounce so a realtime delivery of our own write costs no timer.
    if (sameCartRows(desired, syncedRef.current)) return;

    const timer = setTimeout(() => {
      enqueue(id, desired);
    }, WRITE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // userId is a dependency so that signing out clears a pending write instead of
    // letting it fire later against whichever account is signed in by then.
  }, [lines, userId, enqueue]);
}
