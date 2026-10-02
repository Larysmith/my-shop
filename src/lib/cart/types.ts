export type CartLine = {
  productId: string;
  /**
   * The slug is carried alongside the id because the id is a UUID in production
   * but a p-00X id in demo mode, and only the slug identifies a product in both.
   * Anything that needs to go back to the catalog uses this, never productId.
   */
  slug?: string;
  name: string;
  priceAmount: number;
  imageUrl: string | null;
  quantity: number;
  variantId?: string;
  variantTitle?: string;
  sku?: string;
};
