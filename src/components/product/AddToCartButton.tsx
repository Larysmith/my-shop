"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/useCart";
import type { Product } from "@/lib/sample-products";

type AddToCartButtonProps = {
  product: Product;
  quantity?: number;
  className?: string;
};

export default function AddToCartButton({
  product,
  quantity = 1,
  className = "",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

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
        priceCents: product.price,
        imageUrl: product.image_url,
      },
      quantity,
    );
    setAdded(true);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-live="polite"
      className={`inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors ${
        added
          ? "bg-foreground/10 text-foreground"
          : "bg-foreground text-background hover:opacity-90"
      } ${className}`}
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
