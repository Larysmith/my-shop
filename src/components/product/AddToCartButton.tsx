"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/useCart";
import { getDefaultVariant, type Product, type Variant } from "@/lib/catalog";

type AddToCartButtonProps = {
  product: Product;
  variant?: Variant;
  quantity?: number;
  className?: string;
  disabled?: boolean;
  label?: string;
};

export default function AddToCartButton({
  product,
  variant,
  quantity = 1,
  className = "",
  disabled = false,
  label = "Add to cart",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const chosen = variant ?? getDefaultVariant(product);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1600);
    return () => window.clearTimeout(timer);
  }, [added]);

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        name: product.name,
        priceAmount: chosen.priceAmount,
        imageUrl: product.imageUrl,
        variantId: chosen.id,
        variantTitle: chosen.title,
        sku: chosen.sku,
      },
      quantity,
    );
    setAdded(true);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={disabled}
      aria-live="polite"
      className={`inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        added
          ? "bg-foreground/10 text-foreground"
          : "bg-foreground text-background hover:opacity-90"
      } ${className}`}
    >
      {added ? "Added to cart" : label}
    </button>
  );
}
