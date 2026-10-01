import type { Metadata } from "next";
import { Suspense } from "react";
import CatalogBrowser from "@/components/product/CatalogBrowser";

export const metadata: Metadata = {
  title: "All products",
  description: "Browse the full Lary Shop collection.",
};

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          All products
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/60">
          Eight pieces, built to be kept. Free shipping over $75.
        </p>
      </header>

      <div className="mt-8">
        <Suspense
          fallback={
            <p className="text-sm text-foreground/55">Loading products…</p>
          }
        >
          <CatalogBrowser />
        </Suspense>
      </div>
    </div>
  );
}
