export type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string;
};

export const sampleProducts: Product[] = [
  {
    id: "p-001",
    name: "Everyday Cotton Tee",
    price: 2800,
    image_url: null,
    description:
      "A 180gsm combed cotton tee with a relaxed fit that holds its shape wash after wash.",
  },
  {
    id: "p-002",
    name: "Heavyweight Hoodie",
    price: 7400,
    image_url: null,
    description:
      "Brushed loopback fleece with a double-layered hood and ribbed cuffs that keep their form.",
  },
  {
    id: "p-003",
    name: "Canvas Tote Bag",
    price: 3200,
    image_url: null,
    description:
      "Sixteen-ounce natural canvas, reinforced handles, and an interior pocket sized for a laptop.",
  },
  {
    id: "p-004",
    name: "Ceramic Pour-Over Mug",
    price: 2400,
    image_url: null,
    description:
      "Stoneware mug with a matte exterior and a glazed interior that resists staining.",
  },
  {
    id: "p-005",
    name: "Linen Throw Blanket",
    price: 8900,
    image_url: null,
    description:
      "Washed European linen, breathable and softens with every use. Sized for a full bed.",
  },
  {
    id: "p-006",
    name: "Leather Card Wallet",
    price: 5600,
    image_url: null,
    description:
      "Full-grain vegetable-tanned leather, four slots, and a centre pocket for folded notes.",
  },
  {
    id: "p-007",
    name: "Minimal Desk Lamp",
    price: 11400,
    image_url: null,
    description:
      "Matte powder-coated base with a stepless dimmer and a warm, low-glare LED panel.",
  },
  {
    id: "p-008",
    name: "Merino Wool Socks",
    price: 1800,
    image_url: null,
    description:
      "Temperature-regulating merino blend with a reinforced heel and a flat, seam-free toe.",
  },
];

export function getSampleProduct(id: string): Product | undefined {
  return sampleProducts.find((product) => product.id === id);
}
