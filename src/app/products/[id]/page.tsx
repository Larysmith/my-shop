import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartForm from "@/components/product/AddToCartForm";
import ProductImage from "@/components/product/ProductImage";
import { formatPrice } from "@/lib/pricing";
import { getSampleProduct, sampleProducts } from "@/lib/sample-products";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return sampleProducts.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getSampleProduct(id);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getSampleProduct(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        All products
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-foreground/10">
          <ProductImage product={product} />
        </div>

        <div className="lg:pt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {product.name}
          </h1>
          <p className="mt-3 text-xl font-semibold tabular-nums text-foreground">
            {formatPrice(product.price)}
          </p>
          <p className="mt-6 max-w-prose text-base leading-7 text-foreground/70">
            {product.description}
          </p>

          <div className="mt-8">
            <AddToCartForm product={product} />
          </div>

          <dl className="mt-10 space-y-3 border-t border-foreground/10 pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-foreground/60">Product code</dt>
              <dd className="font-medium text-foreground">{product.id.toUpperCase()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-foreground/60">Shipping</dt>
              <dd className="font-medium text-foreground">
                Free over $75, otherwise $5
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
