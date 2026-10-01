"use client";

import { useCart } from "@/components/cart/useCart";
import type { CartLine } from "@/lib/cart/types";
import { formatPrice } from "@/lib/pricing";
import { getDefaultVariant, getProduct } from "@/lib/catalog";
import ProductArt, { artForProduct } from "@/components/product/ProductArt";
import QuantityStepper from "@/components/product/QuantityStepper";

type CartLineItemProps = {
  line: CartLine;
};

export default function CartLineItem({ line }: CartLineItemProps) {
  const { setQuantity, removeItem } = useCart();

  // Resolve the swatch from the catalog so the thumbnail matches the variant
  // the buyer actually chose, rather than a generic default.
  const product = getProduct(line.productId);
  const variant =
    product?.variants.find((v) => v.id === line.variantId) ??
    (product ? getDefaultVariant(product) : undefined);
  const swatch = variant?.swatch ?? "#d8d4cc";

  return (
    <li className="flex gap-4 py-6 first:pt-0">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-foreground/10 sm:size-24">
        <ProductArt kind={artForProduct(line.productId)} swatch={swatch} />
      </div>

      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
          <p className="mt-1 text-sm text-foreground/60">
            {formatPrice(line.priceAmount)} each
          </p>
          <button
            type="button"
            onClick={() => removeItem(line.productId)}
            className="mt-2 text-sm text-foreground/60 underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Remove
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
          <QuantityStepper
            value={line.quantity}
            onChange={(quantity) => setQuantity(line.productId, quantity)}
          />
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatPrice(line.priceAmount * line.quantity)}
          </p>
        </div>
      </div>
    </li>
  );
}
