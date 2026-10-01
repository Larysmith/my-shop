"use client";

import { useState } from "react";
import type { Product } from "@/lib/sample-products";
import AddToCartButton from "./AddToCartButton";
import QuantityStepper from "./QuantityStepper";

type AddToCartFormProps = {
  product: Product;
};

export default function AddToCartForm({ product }: AddToCartFormProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantityStepper value={quantity} onChange={setQuantity} />
      <div className="min-w-40 flex-1">
        <AddToCartButton product={product} quantity={quantity} />
      </div>
    </div>
  );
}
