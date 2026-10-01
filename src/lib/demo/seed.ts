import { findVariant } from "@/lib/catalog";
import {
  FREE_SHIPPING_THRESHOLD_AMOUNT,
  SHOP_CURRENCY,
  SHIPPING_FLAT_AMOUNT,
} from "@/lib/pricing";
import type { DemoEmail, DemoOrder, DemoOrderItem, OrderStatus } from "./types";
import { DEMO_MERCHANT_EMAIL } from "./types";

function iso(daysAgo: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 12, 0, 0);
  return d.toISOString();
}

type SeedLine = { variantId: string; quantity: number };

function buildItems(lines: SeedLine[]): DemoOrderItem[] {
  return lines.map(({ variantId, quantity }) => {
    const found = findVariant(variantId);
    if (!found) {
      throw new Error(`Seed references unknown variant: ${variantId}`);
    }
    const { product, variant } = found;
    return {
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      variantTitle: variant.title,
      sku: variant.sku,
      unitPriceAmount: variant.priceAmount,
      quantity,
      lineTotalAmount: variant.priceAmount * quantity,
    };
  });
}

function buildOrder({
  orderNumber,
  email,
  userId,
  status,
  lines,
  daysAgo,
  name,
  city,
  region,
  postalCode,
  country = "US",
  line1 = "18 Alder Way",
}: {
  orderNumber: string;
  email: string;
  userId: string | null;
  status: OrderStatus;
  lines: SeedLine[];
  daysAgo: number;
  name: string;
  city: string;
  region: string;
  postalCode: string;
  country?: string;
  line1?: string;
}): DemoOrder {
  const items = buildItems(lines);
  const subtotalAmount = items.reduce((sum, i) => sum + i.lineTotalAmount, 0);
  const shippingAmount =
    subtotalAmount >= FREE_SHIPPING_THRESHOLD_AMOUNT ? 0 : SHIPPING_FLAT_AMOUNT;
  const createdAt = iso(daysAgo);

  const trail: { to: OrderStatus; actor: string; at: string }[] = [
    { to: "pending_payment", actor: "checkout", at: createdAt },
    { to: "paid", actor: "paystack:charge.success", at: createdAt },
  ];
  if (status === "shipped" || status === "completed") {
    trail.push({ to: "shipped", actor: "admin", at: iso(daysAgo - 1, 15) });
  }
  if (status === "completed") {
    trail.push({ to: "completed", actor: "admin", at: iso(daysAgo - 3, 11) });
  }

  return {
    orderNumber,
    userId,
    email,
    status,
    subtotalAmount,
    shippingAmount,
    totalAmount: subtotalAmount + shippingAmount,
    currency: SHOP_CURRENCY,
    shipping: { name, line1, city, region, postalCode, country },
    items,
    events: trail.slice(0, trail.findIndex((t) => t.to === status) + 1).map((t, i, arr) => ({
      fromStatus: i === 0 ? null : arr[i - 1].to,
      toStatus: t.to,
      actor: t.actor,
      createdAt: t.at,
    })),
    createdAt,
    paidAt: createdAt,
  };
}

export function seedOrders(): DemoOrder[] {
  return [
    buildOrder({
      orderNumber: "LS-4KP2QD",
      email: "nina@example.com",
      userId: "demo-user-nina",
      status: "shipped",
      lines: [
        { variantId: "p-002-v1", quantity: 1 },
        { variantId: "p-008-v1", quantity: 2 },
      ],
      daysAgo: 2,
      name: "Nina Alvarez",
      city: "Portland",
      region: "OR",
      postalCode: "97209",
    }),
    buildOrder({
      orderNumber: "LS-9XR7MT",
      email: "nina@example.com",
      userId: "demo-user-nina",
      status: "paid",
      lines: [{ variantId: "p-005-v1", quantity: 1 }],
      daysAgo: 6,
      name: "Nina Alvarez",
      city: "Portland",
      region: "OR",
      postalCode: "97209",
    }),
    buildOrder({
      orderNumber: "LS-2VB6JH",
      email: "guest@example.com",
      userId: null,
      status: "pending_payment",
      lines: [{ variantId: "p-001-v1", quantity: 2 }],
      daysAgo: 0,
      name: "Sam Okafor",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
    }),
    buildOrder({
      orderNumber: "LS-5TN1ZC",
      email: "guest@example.com",
      userId: null,
      status: "canceled",
      lines: [{ variantId: "p-004-v1", quantity: 1 }],
      daysAgo: 9,
      name: "Sam Okafor",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
    }),
  ];
}

export function seedEmails(orders: DemoOrder[]): DemoEmail[] {
  const out: DemoEmail[] = [];
  let n = 0;

  for (const order of orders) {
    const statusPath = order.events.map((e) => e.toStatus);
    const created = new Date(order.createdAt).getTime();
    out.push({
      id: `seed-email-${n++}`,
      orderNumber: order.orderNumber,
      template: "order_confirmation",
      toEmail: order.email,
      subject: `Order ${order.orderNumber} confirmed`,
      status: "sent",
      createdAt: new Date(created + 4_000).toISOString(),
    });
    out.push({
      id: `seed-email-${n++}`,
      orderNumber: order.orderNumber,
      template: "owner_new_order",
      toEmail: DEMO_MERCHANT_EMAIL,
      subject: `New order ${order.orderNumber}`,
      status: "sent",
      createdAt: new Date(created + 5_000).toISOString(),
    });
    if (statusPath.includes("shipped")) {
      out.push({
        id: `seed-email-${n++}`,
        orderNumber: order.orderNumber,
        template: "order_shipped",
        toEmail: order.email,
        subject: `Order ${order.orderNumber} has shipped`,
        status: "sent",
        createdAt: new Date(created + 86_400_000).toISOString(),
      });
      out.push({
        id: `seed-email-${n++}`,
        orderNumber: order.orderNumber,
        template: "owner_shipped",
        toEmail: DEMO_MERCHANT_EMAIL,
        subject: `Shipped ${order.orderNumber}`,
        status: "sent",
        createdAt: new Date(created + 86_500_000).toISOString(),
      });
    }
  }

  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
