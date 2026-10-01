export type CartLine = {
  productId: string;
  name: string;
  priceAmount: number;
  imageUrl: string | null;
  quantity: number;
  variantId?: string;
  variantTitle?: string;
  sku?: string;
};
