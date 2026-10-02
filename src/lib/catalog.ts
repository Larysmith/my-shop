/**
 * Demo catalog. Stands in for the Supabase `products` + `product_variants`
 * tables so the showcase runs with no backend.
 *
 * Prices are minor units of the shop currency (NGN kobo) and match the values
 * migration 0008 writes to `product_variants`, so demo and live look identical.
 *
 * In production the catalog comes from `getCatalog()` in `@/lib/server/catalog`
 * instead. This file is only reachable when NEXT_PUBLIC_DEMO_MODE is on.
 */

import type { Product, Variant } from "@/lib/catalog-types";
import { queryCatalog as queryProductList } from "@/lib/catalog-types";

export type { Product, Variant, SortKey } from "@/lib/catalog-types";
export { getDefaultVariant, findVariant, queryCatalog as filterCatalog } from "@/lib/catalog-types";

function variant(
  productId: string,
  index: number,
  title: string,
  priceAmount: number,
  stock: number,
  swatch: string,
): Variant {
  return {
    id: `${productId}-v${index + 1}`,
    title,
    sku: `LS-${productId.slice(2)}-${String(index + 1).padStart(2, "0")}`,
    priceAmount,
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
    priceAmount: 1800000,
    imageUrl: "/products/everyday-cotton-tee.jpg",
    description:
      "A midweight jersey tee that holds its shape after washing. Cut a little boxy so it layers over a tee.",
    details: [
      "100% combed cotton, 180gsm",
      "Pre-shrunk, garment washed",
      "Ribbed collar with taped neckline",
    ],
    variants: [
      variant("p-001", 0, "Bone / S", 1800000, 12, "#e8e2d6"),
      variant("p-001", 1, "Bone / M", 1800000, 18, "#e8e2d6"),
      variant("p-001", 2, "Bone / L", 1800000, 4, "#e8e2d6"),
      variant("p-001", 3, "Ink / M", 1800000, 9, "#2b3138"),
    ],
  },
  {
    id: "p-002",
    name: "Heavyweight Hoodie",
    slug: "heavyweight-hoodie",
    category: "Apparel",
    priceAmount: 4500000,
    imageUrl: "/products/heavyweight-hoodie.jpg",
    description:
      "A 480gsm loopback hoodie with a lined hood and a kangaroo pocket deep enough to actually use.",
    details: [
      "80% cotton / 20% polyester, 480gsm",
      "Double-layer hood, flat drawcords",
      "Ribbed cuffs and hem",
    ],
    variants: [
      variant("p-002", 0, "Slate / S", 4500000, 7, "#4a5560"),
      variant("p-002", 1, "Slate / M", 4500000, 11, "#4a5560"),
      variant("p-002", 2, "Slate / L", 4500000, 0, "#4a5560"),
      variant("p-002", 3, "Oat / M", 4500000, 6, "#ddd3c2"),
    ],
  },
  {
    id: "p-003",
    name: "Canvas Tote Bag",
    slug: "canvas-tote-bag",
    category: "Accessories",
    priceAmount: 2000000,
    imageUrl: "/products/canvas-tote-bag.jpg",
    description:
      "A 16oz cotton canvas tote with a reinforced base seam. Stands up on its own when it is not full.",
    details: [
      "16oz cotton canvas",
      "38 × 42cm, 10cm gusset",
      "Boxed base, reinforced handles",
    ],
    variants: [
      variant("p-003", 0, "Natural", 2000000, 25, "#dcd3bf"),
      variant("p-003", 1, "Black", 2000000, 14, "#26262a"),
    ],
  },
  {
    id: "p-004",
    name: "Ceramic Pour-Over Mug",
    slug: "ceramic-pour-over-mug",
    category: "Home",
    priceAmount: 1500000,
    imageUrl: "/products/ceramic-pour-over-mug.jpg",
    description:
      "Stoneware mug with a matte exterior and a glazed interior that resists staining.",
    details: [
      "Hand-thrown stoneware, 320ml",
      "Matte exterior, gloss interior",
      "Dishwasher and microwave safe",
    ],
    variants: [
      variant("p-004", 0, "Chalk / 320ml", 1500000, 30, "#eceae4"),
      variant("p-004", 1, "Clay / 320ml", 1500000, 16, "#b5765a"),
      variant("p-004", 2, "Chalk / 450ml", 1700000, 8, "#eceae4"),
    ],
  },
  {
    id: "p-005",
    name: "Linen Throw Blanket",
    slug: "linen-throw-blanket",
    category: "Home",
    priceAmount: 5500000,
    imageUrl: "/products/linen-throw-blanket.jpg",
    description:
      "A washed linen throw that starts crisp and softens with every wash. Sized for a sofa arm.",
    details: [
      "100% European linen, 165gsm",
      "130 × 180cm",
      "Machine washable, tumble dry low",
    ],
    variants: [
      variant("p-005", 0, "Fog", 5500000, 5, "#b6b8b3"),
      variant("p-005", 1, "Terracotta", 5500000, 3, "#b5643f"),
    ],
  },
  {
    id: "p-006",
    name: "Leather Card Wallet",
    slug: "leather-card-wallet",
    category: "Accessories",
    priceAmount: 3500000,
    imageUrl: "/products/leather-card-wallet.jpg",
    description:
      "Four card slots and a centre pocket in full-grain vegetable-tanned leather that darkens with wear.",
    details: [
      "Full-grain vegetable-tanned leather",
      "Four card slots, one centre pocket",
      "Hand-burnished edges",
    ],
    variants: [
      variant("p-006", 0, "Tan", 3500000, 20, "#a9713f"),
      variant("p-006", 1, "Espresso", 3500000, 13, "#3d2b20"),
    ],
  },
  {
    id: "p-007",
    name: "Minimal Desk Lamp",
    slug: "minimal-desk-lamp",
    category: "Home",
    priceAmount: 7000000,
    imageUrl: "/products/minimal-desk-lamp.jpg",
    description:
      "A weighted base and an arm that holds any angle you leave it in. Dimmable, warm to cool white.",
    details: [
      "Powder-coated steel, marble base",
      "2700K–5000K, stepless dimming",
      "USB-C powered, cable included",
    ],
    variants: [
      variant("p-007", 0, "Black", 7000000, 9, "#1f2124"),
      variant("p-007", 1, "White", 7000000, 2, "#f0eee9"),
    ],
  },
  {
    id: "p-008",
    name: "Merino Wool Socks",
    slug: "merino-wool-socks",
    category: "Apparel",
    priceAmount: 1200000,
    imageUrl: "/products/merino-wool-socks.jpg",
    description:
      "Fine-gauge merino that regulates temperature and resists odour, cut to stay up without gripping.",
    details: [
      "80% merino wool / 20% nylon",
      "Ribbed cuff, flat toe seam",
      "Two pairs per order",
    ],
    variants: [
      variant("p-008", 0, "Charcoal / M", 1200000, 40, "#3b3d40"),
      variant("p-008", 1, "Charcoal / L", 1200000, 22, "#3b3d40"),
      variant("p-008", 2, "Rust / M", 1200000, 0, "#9a4a2c"),
    ],
  },
];

export const CATEGORIES = ["Apparel", "Accessories", "Home"] as const;

/**
 * No `getProduct` here on purpose.
 *
 * A lookup helper on the demo dataset invites client components to resolve
 * products against it, which silently returns undefined in production where ids
 * are UUIDs rather than p-001..p-008. Components read the data they were handed;
 * server code goes through `@/lib/server/shop-catalog`.
 */
export function queryCatalog(args: {
  q?: string;
  category?: string;
  sort?: import("@/lib/catalog-types").SortKey;
}): Product[] {
  return queryProductList(catalog, args);
}
