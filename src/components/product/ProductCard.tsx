import Link from "next/link";
import { formatPrice } from "@/lib/pricing";
import type { Product } from "@/lib/sample-products";
import AddToCartButton from "./AddToCartButton";
import ProductImage from "./ProductImage";

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  const href = `/products/${product.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background transition-colors hover:border-foreground/20">
      <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
        <div className="relative aspect-square w-full transition-opacity group-hover:opacity-90">
          <ProductImage product={product} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-sm font-medium text-foreground">
          <Link href={href} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-6 text-foreground/60">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatPrice(product.price)}
          </span>
        </div>
        <AddToCartButton product={product} className="mt-1" />
      </div>
    </article>
  );
}
