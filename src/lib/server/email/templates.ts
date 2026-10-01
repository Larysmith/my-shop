import { formatPrice } from "@/lib/pricing";

export type EmailTemplate =
  | "order_confirmation"
  | "order_shipped"
  | "owner_new_order"
  | "owner_shipped";

export type EmailOrderItem = {
  productName: string;
  variantTitle: string;
  sku: string;
  quantity: number;
  lineTotalAmount: number;
};

export type EmailShipping = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type EmailOrder = {
  orderNumber: string;
  email: string;
  totalAmount: number;
  subtotalAmount: number;
  shippingAmount: number;
  currency: string;
  shipping: EmailShipping;
  items: EmailOrderItem[];
  trackingNumber?: string | null;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function addressLines(shipping: EmailShipping): string[] {
  return [
    shipping.name,
    shipping.line1,
    shipping.line2,
    [shipping.city, shipping.region, shipping.postalCode]
      .filter(Boolean)
      .join(", "),
    shipping.country,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemTable(order: EmailOrder): string {
  const rows = order.items
    .map((item) => {
      const quantity = item.quantity;
      return `<tr>
  <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5">
    ${escapeHtml(item.productName)}<br />
    <span style="color:#666;font-size:12px">${escapeHtml(item.variantTitle)} &middot; ${escapeHtml(item.sku)} &times; ${quantity}</span>
  </td>
  <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;text-align:right;white-space:nowrap">
    ${escapeHtml(formatPrice(item.lineTotalAmount, order.currency.toUpperCase()))}
  </td>
</tr>`;
    })
    .join("\n");

  const totalsRow = (label: string, amount: number, strong = false) =>
    `<tr>
  <td style="padding:4px 0;${strong ? "font-weight:700" : "color:#444"}">${label}</td>
  <td style="padding:4px 0;text-align:right;white-space:nowrap;${strong ? "font-weight:700" : ""}">${escapeHtml(
    formatPrice(amount, order.currency.toUpperCase()),
  )}</td>
</tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${rows}
<tr><td colspan="2" style="padding-top:12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${totalsRow("Subtotal", order.subtotalAmount)}
    ${totalsRow("Shipping", order.shippingAmount)}
    ${totalsRow("Total", order.totalAmount, true)}
  </table>
</td></tr>
</table>`;
}

function itemsText(order: EmailOrder): string {
  const lines = order.items.map(
    (item) =>
      `- ${item.productName} (${item.variantTitle}, SKU ${item.sku}) x${item.quantity} — ${formatPrice(item.lineTotalAmount, order.currency.toUpperCase())}`,
  );
  return [
    ...lines,
    "",
    `Subtotal: ${formatPrice(order.subtotalAmount, order.currency.toUpperCase())}`,
    `Shipping: ${formatPrice(order.shippingAmount, order.currency.toUpperCase())}`,
    `Total: ${formatPrice(order.totalAmount, order.currency.toUpperCase())}`,
  ].join("\n");
}

function addressHtml(shipping: EmailShipping): string {
  return addressLines(shipping)
    .map((line) => escapeHtml(line))
    .join("<br />");
}

function addressText(shipping: EmailShipping): string {
  return addressLines(shipping).join("\n");
}

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f6f5;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
      <h1 style="margin:0 0 4px;font-size:20px">${escapeHtml(title)}</h1>
      ${bodyHtml}
      <p style="margin:24px 0 0;color:#888;font-size:12px">
        This is an automated message. Replies go to the shop inbox.
      </p>
    </div>
  </body>
</html>`;
}

function trackLink(siteUrl: string, orderNumber: string): string {
  return `${siteUrl.replace(/\/$/, "")}/track-order?order=${encodeURIComponent(orderNumber)}`;
}

export function renderEmail(
  template: EmailTemplate,
  order: EmailOrder,
  siteUrl: string,
): RenderedEmail {
  const orderUrl = trackLink(siteUrl, order.orderNumber);
  const address = addressHtml(order.shipping);

  switch (template) {
    case "order_confirmation":
      return {
        subject: `Order ${order.orderNumber} confirmed`,
        html: wrap(
          `Thanks for your order`,
          `<p style="margin:0 0 16px">We received order <strong>${escapeHtml(order.orderNumber)}</strong>. We will email you again when it ships.</p>
           ${itemTable(order)}
           <p style="margin:24px 0 0"><a href="${escapeHtml(orderUrl)}" style="color:#1c1c1a">Track this order</a></p>
           <p style="margin:24px 0 0;color:#444;font-size:14px"><strong>Shipping to</strong><br />${address}</p>`,
        ),
        text: [
          `Thanks for your order ${order.orderNumber}.`,
          "",
          itemsText(order),
          "",
          `Track this order: ${orderUrl}`,
          "",
          "Shipping to",
          addressText(order.shipping),
        ].join("\n"),
      };

    case "order_shipped":
      return {
        subject: `Order ${order.orderNumber} has shipped`,
        html: wrap(
          `Your order is on its way`,
          `<p style="margin:0 0 16px">Order <strong>${escapeHtml(order.orderNumber)}</strong> has shipped.</p>
           ${order.trackingNumber ? `<p style="margin:0 0 16px">Tracking number: <strong>${escapeHtml(order.trackingNumber)}</strong></p>` : ""}
           ${itemTable(order)}
           <p style="margin:24px 0 0"><a href="${escapeHtml(orderUrl)}" style="color:#1c1c1a">Track this order</a></p>
           <p style="margin:24px 0 0;color:#444;font-size:14px"><strong>Shipping to</strong><br />${address}</p>`,
        ),
        text: [
          `Order ${order.orderNumber} has shipped.`,
          ...(order.trackingNumber ? [`Tracking number: ${order.trackingNumber}`] : []),
          "",
          itemsText(order),
          "",
          `Track this order: ${orderUrl}`,
          "",
          "Shipping to",
          addressText(order.shipping),
        ].join("\n"),
      };

    case "owner_new_order":
      return {
        subject: `New order ${order.orderNumber}`,
        html: wrap(
          `New order received`,
          `<p style="margin:0 0 16px">${escapeHtml(order.orderNumber)} — ${escapeHtml(formatPrice(order.totalAmount, order.currency.toUpperCase()))} — ${escapeHtml(order.email)}</p>
           ${itemTable(order)}
           <p style="margin:24px 0 0;color:#444;font-size:14px"><strong>Ship to</strong><br />${address}</p>`,
        ),
        text: [
          `New order ${order.orderNumber}`,
          `Total: ${formatPrice(order.totalAmount, order.currency.toUpperCase())}`,
          `Customer: ${order.email}`,
          "",
          itemsText(order),
          "",
          "Ship to",
          addressText(order.shipping),
        ].join("\n"),
      };

    case "owner_shipped":
      return {
        subject: `Shipped ${order.orderNumber}`,
        html: wrap(
          `Shipment marked`,
          `<p style="margin:0 0 16px">${escapeHtml(order.orderNumber)} was marked shipped${order.trackingNumber ? ` with tracking <strong>${escapeHtml(order.trackingNumber)}</strong>` : ""}.</p>
           ${itemTable(order)}`,
        ),
        text: [
          `Shipment marked for ${order.orderNumber}`,
          ...(order.trackingNumber ? [`Tracking: ${order.trackingNumber}`] : []),
          "",
          itemsText(order),
        ].join("\n"),
      };
  }
}

export function recipientFor(
  template: EmailTemplate,
  order: EmailOrder,
  merchantEmail: string,
): { email: string; name?: string } {
  return template === "order_confirmation" || template === "order_shipped"
    ? { email: order.email }
    : { email: merchantEmail };
}