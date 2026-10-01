import type { Product } from "@/lib/catalog";
import ProductCard from "./ProductCard";

type ProductGridProps = {
  products: Product[];
  emptyMessage?: string;
};

export default function ProductGrid({
  products,
  emptyMessage = "No products yet.",
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center text-sm text-foreground/60">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
