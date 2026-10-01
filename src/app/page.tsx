import Link from "next/link";
import ProductGrid from "@/components/product/ProductGrid";
import { loadCatalog } from "@/lib/server/shop-catalog";
import { DEMO_MODE } from "@/lib/demo/types";
import { FREE_SHIPPING_THRESHOLD_AMOUNT, SHOP_CURRENCY, formatPrice } from "@/lib/pricing";

const freeShipping = formatPrice(FREE_SHIPPING_THRESHOLD_AMOUNT, SHOP_CURRENCY);

const VALUE_POINTS = [
  {
    title: `Free shipping over ${freeShipping}`,
    body: `A flat fee below that, no surprises at checkout.`,
  },
  { title: "Tracked guest orders", body: "Look up any order with the number and your email." },
  { title: "30-day returns", body: "Unworn and in the original packaging, no questions." },
];

export default async function Home() {
  const catalog = await loadCatalog();
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 sm:px-6 lg:px-8">
        {DEMO_MODE && (
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-500/12 px-3.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Demo mode — data is stored in this browser only
          </p>
        )}

        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Modern essentials, made to last.
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-foreground/60">
          A small, deliberate collection of everyday pieces. Free shipping on orders
          over {freeShipping}.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Shop all products
          </Link>
          <Link
            href="/track-order"
            className="inline-flex h-11 items-center rounded-full border border-foreground/15 px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/35"
          >
            Track an order
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <dl className="grid gap-4 sm:grid-cols-3">
          {VALUE_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-foreground/10 p-5"
            >
              <dt className="text-sm font-semibold text-foreground">{point.title}</dt>
              <dd className="mt-1.5 text-sm leading-6 text-foreground/60">{point.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            The collection
          </h2>
          <Link
            href="/products"
            className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <ProductGrid products={catalog} />
      </section>
    </>
  );
}
