import ProductGrid from "@/components/product/ProductGrid";
import { sampleProducts } from "@/lib/sample-products";

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 sm:px-6 lg:px-8">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Modern essentials, made to last.
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-foreground/60">
          A small, deliberate collection of everyday pieces. Free shipping on orders
          over $75.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="sr-only">Products</h2>
        <ProductGrid products={sampleProducts} />
      </section>
    </>
  );
}
