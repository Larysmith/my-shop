/**
 * The order shape the tracking page renders.
 *
 * Kept separate from both the demo store's `DemoOrder` and the server read's
 * `Order` so this component depends on the fields it actually uses rather than on
 * either full type. Both sources satisfy it.
 */
export type TrackedOrder = {
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  items: {
    variantId: string | null;
    productName: string;
    variantTitle: string;
    quantity: number;
    lineTotalAmount: number;
  }[];
  shipping: {
    name: string;
    city: string;
  };
};
