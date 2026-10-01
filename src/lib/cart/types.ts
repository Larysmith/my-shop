export type CartLine = {
  productId: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
  variantId?: string;
  variantTitle?: string;
  sku?: string;
};
