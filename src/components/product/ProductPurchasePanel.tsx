"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/pricing";
import { getDefaultVariant, type Product, type Variant } from "@/lib/catalog";
import ProductArt, { artForProduct } from "./ProductArt";
import AddToCartButton from "./AddToCartButton";
import QuantityStepper from "./QuantityStepper";

// Holds the selected variant so the artwork, the price and the SKU all move
// together. Splitting this into the art and the form would let them disagree.
export default function ProductPurchasePanel({ product }: { product: Product }) {
  const [selectedId, setSelectedId] = useState(getDefaultVariant(product).id);
  const [quantity, setQuantity] = useState(1);

  const selected: Variant =
    product.variants.find((v) => v.id === selectedId) ?? getDefaultVariant(product);

  const soldOut = selected.stock === 0;
  const maxQuantity = Math.min(selected.stock, 10);
  const cheapest = Math.min(...product.variants.map((v) => v.priceCents));

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-foreground/10">
        <ProductArt kind={artForProduct(product.slug)} swatch={selected.swatch} />
        <span className="absolute bottom-3 left-0 right-0 text-center text-[10px] font-medium tracking-[0.18em] text-[#1c1c1e]/35">
          {product.id.toUpperCase()}
        </span>
      </div>

      <div className="lg:pt-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/45">
          {product.category}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {product.name}
        </h1>
        <p className="mt-2 text-sm text-foreground/55">
          From {formatPrice(cheapest)} · {inStockLabel(product)}
        </p>
        <p className="mt-5 max-w-prose text-base leading-7 text-foreground/70">
          {product.description}
        </p>

        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-foreground">
            Options
            <span className="ml-2 font-normal text-foreground/55">{selected.title}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.variants.map((item) => {
              const isActive = item.id === selected.id;
              const isOut = item.stock === 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/15 text-foreground/75 hover:border-foreground/35"
                  } ${isOut ? "opacity-45" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className="size-3.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: item.swatch }}
                  />
                  {item.title}
                  {isOut && <span className="text-[11px] opacity-70">sold out</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5 flex items-baseline gap-3">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatPrice(selected.priceCents)}
          </p>
          <p className="text-xs text-foreground/50">
            SKU {selected.sku} ·{" "}
            {soldOut
              ? "out of stock"
              : selected.stock <= 5
                ? `only ${selected.stock} left`
                : "in stock"}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} />
          <div className="min-w-40 flex-1">
            <AddToCartButton
              product={product}
              variant={selected}
              quantity={quantity}
              disabled={soldOut}
              label={soldOut ? "Sold out" : "Add to cart"}
            />
          </div>
        </div>

        <dl className="mt-10 space-y-3 border-t border-foreground/10 pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-foreground/60">Product code</dt>
            <dd className="font-medium text-foreground">{product.id.toUpperCase()}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-foreground/60">Availability</dt>
            <dd className="font-medium text-foreground">{inStockLabel(product)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-foreground/60">Shipping</dt>
            <dd className="font-medium text-foreground">Free over $75, otherwise $5</dd>
          </div>
        </dl>

        <div className="mt-8 border-t border-foreground/10 pt-6">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <ul className="mt-3 space-y-2">
            {product.details.map((detail) => (
              <li key={detail} className="flex gap-2.5 text-sm text-foreground/65">
                <span
                  aria-hidden="true"
                  className="mt-2 size-1 shrink-0 rounded-full bg-foreground/30"
                />
                {detail}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function inStockLabel(product: Product): string {
  const inStock = product.variants.filter((v) => v.stock > 0).length;
  return `${inStock} of ${product.variants.length} options in stock`;
}