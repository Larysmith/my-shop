import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import ProductImage from "@/components/product/ProductImage";
import { getDefaultVariant } from "@/lib/catalog-types";
import { loadCatalog, loadCatalogSlugs, loadProduct } from "@/lib/server/shop-catalog";
import { formatPrice } from "@/lib/pricing";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Pre-render one page per product.
 *
 * In production the slugs come from the database, so a newly added product is
 * server-rendered on first request rather than needing a rebuild. `dynamicParams`
 * defaults to true, which is what makes that work.
 */
export async function generateStaticParams() {
  const slugs = await loadCatalogSlugs();
  return slugs.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

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
  // Accepts a slug or a uuid, because the related-product links use the id and
  // old links may still carry either.
  const product = await loadProduct(id);

  if (!product) {
    notFound();
  }

  const catalog = await loadCatalog();
  const related = catalog.filter((p) => p.id !== product.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <Link
          href="/"
          className="text-foreground/60 transition-colors hover:text-foreground"
        >
          Home
        </Link>
        <span aria-hidden="true" className="text-foreground/30">
          /
        </span>
        <Link
          href="/products"
          className="text-foreground/60 transition-colors hover:text-foreground"
        >
          Products
        </Link>
        <span aria-hidden="true" className="text-foreground/30">
          /
        </span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-6">
        <ProductPurchasePanel product={product} />
      </div>

      <section className="mt-16 border-t border-foreground/10 pt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          You may also like
        </h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          {related.map((item) => (
            <Link
              key={item.id}
              href={`/products/${item.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-foreground/10 p-3 transition-colors hover:border-foreground/25"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                {/* ProductImage so the thumbnail uses the catalog photo when there
                    is one, instead of always falling back to generated art. */}
                <ProductImage
                  product={{
                    id: item.id,
                    name: item.name,
                    slug: item.slug,
                    imageUrl: item.imageUrl,
                    swatch: getDefaultVariant(item).swatch,
                  }}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground group-hover:underline">
                  {item.name}
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-foreground/60">
                  {formatPrice(item.priceAmount)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}