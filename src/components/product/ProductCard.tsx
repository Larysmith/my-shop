import Link from "next/link";
import { formatPrice } from "@/lib/pricing";
import { getDefaultVariant, type Product } from "@/lib/catalog-types";
import AddToCartButton from "./AddToCartButton";
import ProductImage from "./ProductImage";

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  // The slug, not the id. The id is a UUID in production and a p-00X string in
  // demo mode, so it is neither stable nor readable in a URL. The PDP accepts
  // both, but links should always be the canonical slug.
  const href = `/products/${product.slug}`;
  const isSoldOut = product.variants.every((v) => v.stock === 0);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background transition-colors hover:border-foreground/20">
      <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
        <div className="relative aspect-square w-full transition-opacity group-hover:opacity-90">
          <ProductImage
            product={{
              id: product.id,
              name: product.name,
              imageUrl: product.imageUrl,
              swatch: getDefaultVariant(product).swatch,
            }}
          />
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/45">
          {product.category}
        </p>
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
            {formatPrice(product.priceAmount)}
          </span>
          {isSoldOut ? (
            <span className="rounded-full bg-foreground/8 px-2.5 py-1 text-[11px] font-medium text-foreground/55">
              Sold out
            </span>
          ) : (
            <span className="text-[11px] text-foreground/45">
              {product.variants.length} options
            </span>
          )}
        </div>
        <AddToCartButton product={product} className="mt-1" disabled={isSoldOut} />
      </div>
    </article>
  );
}
