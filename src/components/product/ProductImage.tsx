import Image from "next/image";

export type ProductImageSource = {
  id: string;
  name: string;
  image_url: string | null;
};

function hueFromSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}

export default function ProductImage({ product }: { product: ProductImageSource }) {
  if (product.image_url) {
    return (
      <Image
        src={product.image_url}
        alt={product.name}
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover"
      />
    );
  }

  const hue = hueFromSeed(product.id);
  return (
    <div
      aria-hidden="true"
      className="flex size-full items-center justify-center text-4xl font-semibold tracking-tight sm:text-5xl"
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 62% 93%), hsl(${(hue + 40) % 360} 58% 86%))`,
        color: `hsl(${hue} 40% 32%)`,
      }}
    >
      {product.name
        .split(" ")
        .slice(0, 2)
        .map((word) => word[0])
        .join("")}
    </div>
  );
}
