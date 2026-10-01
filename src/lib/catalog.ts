// Demo catalog. Stands in for the Supabase `products` + `product_variants`
// tables, which the migration has not applied yet. Every variant carries its own
// price and stock, mirroring the eventual one-Stripe-Price-per-variant model.
//
// `priceCents` on a product is the price of its default variant, kept so the
// existing card, grid and cart code can keep treating a product as a single
// priced thing.

export type Variant = {
  id: string;
  title: string;
  sku: string;
  priceCents: number;
  stock: number;
  swatch: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  priceCents: number;
  imageUrl: string | null;
  description: string;
  details: string[];
  variants: Variant[];
};

function variant(
  productId: string,
  index: number,
  title: string,
  priceCents: number,
  stock: number,
  swatch: string,
): Variant {
  return {
    id: `${productId}-v${index + 1}`,
    title,
    sku: `LS-${productId.slice(2)}-${String(index + 1).padStart(2, "0")}`,
    priceCents,
    stock,
    swatch,
  };
}

export const catalog: Product[] = [
  {
    id: "p-001",
    name: "Everyday Cotton Tee",
    slug: "everyday-cotton-tee",
    category: "Apparel",
    priceCents: 2800,
    imageUrl: null,
    description:
      "A 180gsm combed cotton tee with a relaxed fit that holds its shape wash after wash.",
    details: [
      "180gsm combed ring-spun cotton",
      "Pre-shrunk, garment dyed",
      "Ribbed collar with twin-needle hem",
    ],
    variants: [
      variant("p-001", 0, "Bone / S", 2800, 12, "#e7e0d3"),
      variant("p-001", 1, "Bone / M", 2800, 18, "#e7e0d3"),
      variant("p-001", 2, "Bone / L", 2800, 4, "#e7e0d3"),
      variant("p-001", 3, "Ink / M", 2800, 9, "#2b2f38"),
    ],
  },
  {
    id: "p-002",
    name: "Heavyweight Hoodie",
    slug: "heavyweight-hoodie",
    category: "Apparel",
    priceCents: 7400,
    imageUrl: null,
    description:
      "Brushed loopback fleece with a double-layered hood and ribbed cuffs that keep their form.",
    details: [
      "420gsm brushed loopback cotton",
      "Double-layered hood, no drawcords",
      "Kangaroo pocket with hidden phone sleeve",
    ],
    variants: [
      variant("p-002", 0, "Slate / S", 7400, 7, "#4a5260"),
      variant("p-002", 1, "Slate / M", 7400, 11, "#4a5260"),
      variant("p-002", 2, "Slate / L", 7400, 0, "#4a5260"),
      variant("p-002", 3, "Oat / M", 7400, 6, "#d9cdb8"),
    ],
  },
  {
    id: "p-003",
    name: "Canvas Tote Bag",
    slug: "canvas-tote-bag",
    category: "Accessories",
    priceCents: 3200,
    imageUrl: null,
    description:
      "Sixteen-ounce natural canvas, reinforced handles, and an interior pocket sized for a laptop.",
    details: [
      "16oz natural cotton canvas",
      "Interior pocket fits a 14in laptop",
      "Boxed base with reinforced bar tacks",
    ],
    variants: [
      variant("p-003", 0, "Natural", 3200, 25, "#d8c9a8"),
      variant("p-003", 1, "Black", 3200, 14, "#1c1c1e"),
    ],
  },
  {
    id: "p-004",
    name: "Ceramic Pour-Over Mug",
    slug: "ceramic-pour-over-mug",
    category: "Home",
    priceCents: 2400,
    imageUrl: null,
    description:
      "Stoneware mug with a matte exterior and a glazed interior that resists staining.",
    details: [
      "Hand-thrown stoneware, 320ml",
      "Matte exterior, gloss interior",
      "Dishwasher and microwave safe",
    ],
    variants: [
      variant("p-004", 0, "Chalk / 320ml", 2400, 30, "#eceae4"),
      variant("p-004", 1, "Clay / 320ml", 2400, 16, "#b5765a"),
      variant("p-004", 2, "Chalk / 450ml", 2700, 8, "#eceae4"),
    ],
  },
  {
    id: "p-005",
    name: "Linen Throw Blanket",
    slug: "linen-throw-blanket",
    category: "Home",
    priceCents: 8900,
    imageUrl: null,
    description:
      "Washed European linen, breathable and softens with every use. Sized for a full bed.",
    details: [
      "100% washed European linen",
      "130 x 180cm, blanket-stitched edge",
      "Softens with every wash",
    ],
    variants: [
      variant("p-005", 0, "Fog", 8900, 5, "#b9bcbd"),
      variant("p-005", 1, "Terracotta", 8900, 3, "#b5654a"),
    ],
  },
  {
    id: "p-006",
    name: "Leather Card Wallet",
    slug: "leather-card-wallet",
    category: "Accessories",
    priceCents: 5600,
    imageUrl: null,
    description:
      "Full-grain vegetable-tanned leather, four slots, and a centre pocket for folded notes.",
    details: [
      "Full-grain vegetable-tanned leather",
      "Four card slots plus centre cash pocket",
      "Hand-burnished edges, no lining",
    ],
    variants: [
      variant("p-006", 0, "Tan", 5600, 20, "#a9743f"),
      variant("p-006", 1, "Espresso", 5600, 13, "#4a342a"),
    ],
  },
  {
    id: "p-007",
    name: "Minimal Desk Lamp",
    slug: "minimal-desk-lamp",
    category: "Home",
    priceCents: 11400,
    imageUrl: null,
    description:
      "Matte powder-coated base with a stepless dimmer and a warm, low-glare LED panel.",
    details: [
      "Powder-coated aluminium base",
      "Stepless dimmer, 2700-4000K",
      "Weighted base, no visible fixings",
    ],
    variants: [
      variant("p-007", 0, "Black", 11400, 9, "#232326"),
      variant("p-007", 1, "White", 11400, 2, "#f1f1ef"),
    ],
  },
  {
    id: "p-008",
    name: "Merino Wool Socks",
    slug: "merino-wool-socks",
    category: "Apparel",
    priceCents: 1800,
    imageUrl: null,
    description:
      "Temperature-regulating merino blend with a reinforced heel and a flat, seam-free toe.",
    details: [
      "80% merino, 20% nylon",
      "Reinforced heel and toe",
      "Seam-free, 3-pack",
    ],
    variants: [
      variant("p-008", 0, "Charcoal / M", 1800, 40, "#3a3d42"),
      variant("p-008", 1, "Charcoal / L", 1800, 22, "#3a3d42"),
      variant("p-008", 2, "Rust / M", 1800, 0, "#9a4f30"),
    ],
  },
];

export const CATEGORIES: string[] = [...new Set(catalog.map((p) => p.category))].sort();

export function getProduct(idOrSlug: string): Product | undefined {
  return catalog.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
}

export function getDefaultVariant(product: Product): Variant {
  return product.variants[0];
}

export function findVariant(variantId: string): { product: Product; variant: Variant } | undefined {
  for (const product of catalog) {
    const found = product.variants.find((v) => v.id === variantId);
    if (found) return { product, variant: found };
  }
  return undefined;
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "name";

export function queryCatalog({
  q = "",
  category = "all",
  sort = "featured",
}: {
  q?: string;
  category?: string;
  sort?: SortKey;
}): Product[] {
  const needle = q.trim().toLowerCase();

  const filtered = catalog.filter((product) => {
    if (category !== "all" && product.category !== category) return false;
    if (!needle) return true;
    return (
      product.name.toLowerCase().includes(needle) ||
      product.description.toLowerCase().includes(needle) ||
      product.category.toLowerCase().includes(needle)
    );
  });

  const sorted = [...filtered];
  switch (sort) {
    case "price-asc":
      sorted.sort((a, b) => a.priceCents - b.priceCents);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.priceCents - a.priceCents);
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      break;
  }
  return sorted;
}
