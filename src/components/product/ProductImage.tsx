import Image from "next/image";
import ProductArt, { artForProduct } from "./ProductArt";

export type ProductImageSource = {
  id: string;
  name: string;
  slug?: string;
  imageUrl: string | null;
  swatch?: string;
};

export default function ProductImage({ product }: { product: ProductImageSource }) {
  if (product.imageUrl) {
    return (
      <Image
        src={product.imageUrl}
        alt={product.name}
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover"
      />
    );
  }

  return (
    <div className="relative size-full overflow-hidden">
      <ProductArt
        kind={artForProduct(product.slug ?? product.id)}
        swatch={product.swatch ?? "#d8d4cc"}
      />
      <span className="absolute bottom-2.5 left-0 right-0 text-center text-[10px] font-medium tracking-[0.18em] text-[#1c1c1e]/35">
        {product.id.toUpperCase()}
      </span>
    </div>
  );
}