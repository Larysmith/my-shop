"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ProductGrid from "@/components/product/ProductGrid";
import { CATEGORIES, queryCatalog, type SortKey } from "@/lib/catalog";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

export default function CatalogBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const category = searchParams.get("category") ?? "all";
  const sort = (searchParams.get("sort") as SortKey) ?? "featured";

  // Debounce so typing does not push a history entry per keystroke.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      router.replace(`/products?${params.toString()}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, searchParams, router]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || !value) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
  }

  const results = queryCatalog({ q, category, sort });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="catalog-search" className="sr-only">
            Search products
          </label>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-foreground/40"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="catalog-search"
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search products"
            className="h-11 w-full rounded-full border border-foreground/15 bg-background pr-4 pl-11 text-sm text-foreground placeholder:text-foreground/40 focus:border-foreground/40 focus:outline-none"
          />
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <label htmlFor="catalog-category" className="sr-only">
              Filter by category
            </label>
            <select
              id="catalog-category"
              value={category}
              onChange={(event) => setParam("category", event.target.value)}
              className="h-11 appearance-none rounded-full border border-foreground/15 bg-background pr-9 pl-4 text-sm font-medium text-foreground focus:border-foreground/40 focus:outline-none"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-foreground/45"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          <div className="relative">
            <label htmlFor="catalog-sort" className="sr-only">
              Sort products
            </label>
            <select
              id="catalog-sort"
              value={sort}
              onChange={(event) => setParam("sort", event.target.value)}
              className="h-11 appearance-none rounded-full border border-foreground/15 bg-background pr-9 pl-4 text-sm font-medium text-foreground focus:border-foreground/40 focus:outline-none"
            >
              {SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-foreground/45"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-foreground/55" aria-live="polite">
        {results.length} {results.length === 1 ? "product" : "products"}
        {q && ` matching “${q}”`}
      </p>

      <div className="mt-5">
        <ProductGrid
          products={results}
          emptyMessage="Nothing matched that. Try a different search or category."
        />
      </div>
    </div>
  );
}
