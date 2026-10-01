export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export const SHIPPING_FLAT_CENTS = 500;
export const FREE_SHIPPING_THRESHOLD_CENTS = 7500;

export type PricedLine = {
  priceCents: number;
  quantity: number;
};

export function computeTotals(lines: PricedLine[]) {
  const subtotalCents = lines.reduce(
    (total, line) => total + line.priceCents * line.quantity,
    0,
  );
  const shippingCents =
    subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : SHIPPING_FLAT_CENTS;

  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
  };
}
