"use client";

import { seedEmails, seedOrders } from "@/lib/demo/seed";
import type { DemoEmail, DemoOrder, DemoUser } from "@/lib/demo/types";

const ORDERS_KEY = "lary-shop.demo.orders.v1";
const EMAILS_KEY = "lary-shop.demo.emails.v1";
const SESSION_KEY = "lary-shop.demo.session.v1";

export type DemoState = {
  orders: DemoOrder[];
  emails: DemoEmail[];
  user: DemoUser | null;
};

// The server has no localStorage, so it renders this. useSyncExternalStore
// swaps to the real snapshot right after hydration, which is why this does not
// produce a hydration mismatch.
const SERVER_STATE: DemoState = { orders: [], emails: [], user: null };

let state: DemoState = SERVER_STATE;
let initialised = false;
const listeners = new Set<() => void>();

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota. The demo still works in memory.
  }
}

function commit(next: DemoState, persist = true) {
  state = next;
  if (persist) {
    writeJson(ORDERS_KEY, next.orders);
    writeJson(EMAILS_KEY, next.emails);
    writeJson(SESSION_KEY, next.user);
  }
  for (const listener of listeners) listener();
}

// Runs once on the client. Seeds the browser on first visit so the admin and
// tracking pages have something to show.
function initialise() {
  if (initialised) return;
  initialised = true;

  let orders = readJson<DemoOrder[]>(ORDERS_KEY);
  let emails = readJson<DemoEmail[]>(EMAILS_KEY);

  if (!orders || orders.length === 0) orders = seedOrders();
  if (!emails || emails.length === 0) emails = seedEmails(orders);

  state = {
    orders,
    emails,
    user: readJson<DemoUser | null>(SESSION_KEY),
  };

  writeJson(ORDERS_KEY, orders);
  writeJson(EMAILS_KEY, emails);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (!event.key || !event.key.startsWith("lary-shop.demo.")) return;
    initialised = false;
    initialise();
    for (const l of listeners) l();
  };

  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): DemoState {
  initialise();
  return state;
}

export function getServerSnapshot(): DemoState {
  return SERVER_STATE;
}

export const demoActions = {
  setUser(user: DemoUser | null) {
    commit({ ...state, user });
  },

  addOrder(order: DemoOrder) {
    commit({ ...state, orders: [order, ...state.orders] });
  },

  addEmails(entries: DemoEmail[]) {
    if (entries.length === 0) return;
    commit({ ...state, emails: [...entries, ...state.emails] });
  },

  updateOrder(orderNumber: string, update: (order: DemoOrder) => DemoOrder) {
    commit({
      ...state,
      orders: state.orders.map((order) =>
        order.orderNumber === orderNumber ? update(order) : order,
      ),
    });
  },

  reset() {
    const orders = seedOrders();
    commit({ orders, emails: seedEmails(orders), user: null });
  },
};
