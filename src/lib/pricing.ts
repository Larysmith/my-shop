/**
 * Money handling for the shop.
 *
 * Amounts are integer **minor units** — kobo for NGN, cents for USD — because that
 * is what Paystack charges in and what the database stores. No amount in this
 * codebase is ever a float, so no rounding error can accumulate in a total.
 *
 * The ISO code travels alongside every amount in `currency`; it is never inferred
 * from the amount itself.
 */
export const SHOP_CURRENCY = "NGN";

/**
 * Renders a minor-unit amount.
 *
 * The locale is tied to the currency so the symbol and separators read naturally
 * for the market: NGN formatted with an en-US locale renders "NGN 45,000.00"
 * rather than "₦45,000.00", which is not what a Nigerian shopper expects to see.
 */
export function formatPrice(amount: number, currency: string = SHOP_CURRENCY): string {
  const locale = currency === "NGN" ? "en-NG" : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

// ₦3,500 flat below the free-shipping threshold.
export const SHIPPING_FLAT_AMOUNT = 350_000;
// Free at ₦50,000 and above.
export const FREE_SHIPPING_THRESHOLD_AMOUNT = 5_000_000;

export type PricedLine = {
  priceAmount: number;
  quantity: number;
};

export function computeTotals(lines: PricedLine[]) {
  const subtotalAmount = lines.reduce(
    (total, line) => total + line.priceAmount * line.quantity,
    0,
  );
  const shippingAmount =
    subtotalAmount === 0 || subtotalAmount >= FREE_SHIPPING_THRESHOLD_AMOUNT
      ? 0
      : SHIPPING_FLAT_AMOUNT;

  return {
    subtotalAmount,
    shippingAmount,
    totalAmount: subtotalAmount + shippingAmount,
  };
}