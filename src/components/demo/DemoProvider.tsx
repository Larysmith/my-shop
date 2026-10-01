"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEMO_MERCHANT_EMAIL } from "@/lib/demo/types";
import type {
  DemoEmail,
  DemoOrder,
  DemoShipping,
  DemoUser,
  EmailTemplate,
  OrderStatus,
} from "@/lib/demo/types";
import {
  demoActions,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/demo/browser-store";
import type { CartLine } from "@/lib/cart/types";
import { computeTotals } from "@/lib/pricing";

const DEMO_USERS: DemoUser[] = [
  { id: "demo-user-nina", email: "nina@example.com", fullName: "Nina Alvarez", isAdmin: false },
  { id: "demo-user-owner", email: DEMO_MERCHANT_EMAIL, fullName: "Lary (store owner)", isAdmin: true },
];

function generateOrderNumber(existing: string[]): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let out = "";
    for (let i = 0; i < 6; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const candidate = `LS-${out}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `LS-${Date.now().toString(36).toUpperCase()}`;
}

function subjectFor(template: EmailTemplate, orderNumber: string): string {
  switch (template) {
    case "order_confirmation":
      return `Order ${orderNumber} confirmed`;
    case "order_shipped":
      return `Order ${orderNumber} has shipped`;
    case "owner_new_order":
      return `New order ${orderNumber}`;
    case "owner_shipped":
      return `Shipped ${orderNumber}`;
  }
}

function emailEntry(order: DemoOrder, template: EmailTemplate): DemoEmail {
  const toEmail =
    template === "order_confirmation" || template === "order_shipped"
      ? order.email
      : DEMO_MERCHANT_EMAIL;
  return {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    orderNumber: order.orderNumber,
    template,
    toEmail,
    subject: subjectFor(template, order.orderNumber),
    status: "sent",
    createdAt: new Date().toISOString(),
  };
}

export type PlaceOrderInput = {
  email: string;
  shipping: DemoShipping;
  lines: CartLine[];
  customerNotes?: string;
};

type DemoContextValue = {
  hydrated: boolean;
  user: DemoUser | null;
  orders: DemoOrder[];
  emails: DemoEmail[];
  signIn: (email: string) => DemoUser | null;
  signOut: () => void;
  placeOrder: (input: PlaceOrderInput) => DemoOrder;
  getOrder: (orderNumber: string) => DemoOrder | undefined;
  lookupGuestOrder: (orderNumber: string, email: string) => DemoOrder | undefined;
  updateStatus: (orderNumber: string, status: OrderStatus) => void;
  resendEmail: (orderNumber: string, template: EmailTemplate) => void;
  resetDemo: () => void;
  availableAccounts: DemoUser[];
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const { orders, emails, user } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const hydrated = orders.length > 0 || emails.length > 0 || user !== null;

  const signIn = useCallback((email: string) => {
    const found =
      DEMO_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null;
    demoActions.setUser(found);
    return found;
  }, []);

  const signOut = useCallback(() => demoActions.setUser(null), []);

  const placeOrder = useCallback(
    (input: PlaceOrderInput): DemoOrder => {
      const now = new Date().toISOString();
      const items = input.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId ?? `${line.productId}-v1`,
        productName: line.name,
        variantTitle: line.variantTitle ?? "Default",
        sku: line.sku ?? `LS-${line.productId.slice(2)}-01`,
        unitPriceCents: line.priceCents,
        quantity: line.quantity,
        lineTotalCents: line.priceCents * line.quantity,
      }));

      // The real build re-prices inside the create_pending_order RPC. The demo
      // calls the same shared pricing module so the rule cannot diverge.
      const { subtotalCents, shippingCents, totalCents } = computeTotals(input.lines);

      const order: DemoOrder = {
        orderNumber: generateOrderNumber(orders.map((o) => o.orderNumber)),
        userId: user?.id ?? null,
        email: input.email.trim().toLowerCase(),
        status: "paid",
        subtotalCents,
        shippingCents,
        totalCents,
        currency: "usd",
        shipping: input.shipping,
        items,
        events: [
          { fromStatus: null, toStatus: "pending_payment", actor: "checkout", createdAt: now },
          {
            fromStatus: "pending_payment",
            toStatus: "paid",
            actor: "stripe:checkout.session.completed",
            createdAt: now,
          },
        ],
        customerNotes: input.customerNotes,
        createdAt: now,
        paidAt: now,
      };

      demoActions.addOrder(order);
      demoActions.addEmails([
        emailEntry(order, "order_confirmation"),
        emailEntry(order, "owner_new_order"),
      ]);
      return order;
    },
    [orders, user],
  );

  const getOrder = useCallback(
    (orderNumber: string) =>
      orders.find((o) => o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase()),
    [orders],
  );

  const lookupGuestOrder = useCallback(
    (orderNumber: string, email: string) =>
      orders.find(
        (o) =>
          o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase() &&
          o.email.toLowerCase() === email.trim().toLowerCase(),
      ),
    [orders],
  );

  const updateStatus = useCallback(
    (orderNumber: string, status: OrderStatus) => {
      const order = getOrder(orderNumber);
      if (!order || order.status === status) return;

      const now = new Date().toISOString();
      const updated: DemoOrder = {
        ...order,
        status,
        events: [
          ...order.events,
          { fromStatus: order.status, toStatus: status, actor: "admin", createdAt: now },
        ],
      };
      demoActions.updateOrder(order.orderNumber, () => updated);

      if (status === "shipped") {
        demoActions.addEmails([
          emailEntry(updated, "order_shipped"),
          emailEntry(updated, "owner_shipped"),
        ]);
      }
    },
    [getOrder],
  );

  const resendEmail = useCallback(
    (orderNumber: string, template: EmailTemplate) => {
      const order = getOrder(orderNumber);
      if (order) demoActions.addEmails([emailEntry(order, template)]);
    },
    [getOrder],
  );

  const resetDemo = useCallback(() => demoActions.reset(), []);

  const value = useMemo<DemoContextValue>(
    () => ({
      hydrated,
      user,
      orders,
      emails,
      signIn,
      signOut,
      placeOrder,
      getOrder,
      lookupGuestOrder,
      updateStatus,
      resendEmail,
      resetDemo,
      availableAccounts: DEMO_USERS,
    }),
    [
      hydrated,
      user,
      orders,
      emails,
      signIn,
      signOut,
      placeOrder,
      getOrder,
      lookupGuestOrder,
      updateStatus,
      resendEmail,
      resetDemo,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}
