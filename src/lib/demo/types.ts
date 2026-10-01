export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipped"
  | "completed"
  | "canceled"
  | "refunded";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending_payment",
  "paid",
  "shipped",
  "completed",
  "canceled",
  "refunded",
];

export type DemoShipping = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type DemoOrderItem = {
  productId: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type DemoOrderEvent = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actor: string;
  createdAt: string;
};

export type DemoOrder = {
  orderNumber: string;
  userId: string | null;
  email: string;
  status: OrderStatus;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  shipping: DemoShipping;
  items: DemoOrderItem[];
  events: DemoOrderEvent[];
  customerNotes?: string;
  createdAt: string;
  paidAt: string | null;
};

export type EmailTemplate =
  | "order_confirmation"
  | "order_shipped"
  | "owner_new_order"
  | "owner_shipped";

export type DemoEmail = {
  id: string;
  orderNumber: string;
  template: EmailTemplate;
  toEmail: string;
  subject: string;
  status: "sent" | "failed";
  error?: string;
  createdAt: string;
};

export type DemoUser = {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
};

export const DEMO_MERCHANT_EMAIL = "owner@lary-shop.test";
