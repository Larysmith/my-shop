import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cartRowKey,
  hydrateCartRows,
  mergeCartRows,
  toCartRows,
  type CartRow,
} from "../src/lib/cart/hydrate";
import { MAX_QUANTITY } from "../src/lib/cart/quantity";
import { sameCartRows } from "../src/lib/cart/remote";
import type { Product, Variant } from "../src/lib/catalog-types";

function variant(overrides: Partial<Variant> & { id: string }): Variant {
  return {
    title: "Bone / M",
    sku: `SKU-${overrides.id}`,
    priceAmount: 1_800_000,
    stock: 10,
    swatch: "#e8e2d6",
    ...overrides,
  };
}

const TEE: Product = {
  id: "p-tee",
  name: "Everyday Cotton Tee",
  slug: "everyday-cotton-tee",
  category: "Apparel",
  priceAmount: 1_800_000,
  imageUrl: "/products/everyday-cotton-tee.jpg",
  description: "A tee.",
  details: ["Apparel · 2 variants"],
  variants: [
    variant({ id: "v-bone", priceAmount: 1_800_000 }),
    variant({ id: "v-ink", title: "Ink / M", priceAmount: 1_800_000 }),
  ],
};

const MUG: Product = {
  id: "p-mug",
  name: "Ceramic Pour-Over Mug",
  slug: "ceramic-pour-over-mug",
  category: "Home",
  priceAmount: 2_400_000,
  imageUrl: "/products/ceramic-pour-over-mug.jpg",
  description: "A mug.",
  details: ["Home · 1 variant"],
  variants: [variant({ id: "v-clay", title: "Clay", priceAmount: 2_400_000 })],
};

const CATALOG = [TEE, MUG];

describe("hydrateCartRows", () => {
  it("resolves a stored row against the live catalog", () => {
    const lines = hydrateCartRows(
      [{ productId: "p-tee", variantId: "v-ink", quantity: 2 }],
      CATALOG,
    );

    assert.equal(lines.length, 1);
    assert.equal(lines[0].slug, "everyday-cotton-tee");
    assert.equal(lines[0].variantTitle, "Ink / M");
    assert.equal(lines[0].quantity, 2);
  });

  it("takes the price from the catalog, never from the row", () => {
    // The stored row carries no amount at all, which is the point: a price change
    // must reach a cart that is already sitting on the server.
    const stale: CartRow = { productId: "p-tee", variantId: "v-bone", quantity: 1 };
    const repriced: Product = {
      ...TEE,
      variants: TEE.variants.map((v) => ({ ...v, priceAmount: 2_500_000 })),
    };

    const lines = hydrateCartRows([stale], [repriced]);
    assert.equal(lines[0].priceAmount, 2_500_000);
  });

  it("drops a row whose variant is no longer in the catalog", () => {
    // What an admin switching a variant off looks like: the RLS-filtered catalog
    // read omits it, so the row can no longer be resolved to anything buyable.
    const lines = hydrateCartRows(
      [
        { productId: "p-tee", variantId: "v-retired", quantity: 1 },
        { productId: "p-mug", variantId: "v-clay", quantity: 1 },
      ],
      CATALOG,
    );

    assert.equal(lines.length, 1);
    assert.equal(lines[0].productId, "p-mug");
  });

  it("clamps a quantity the client could not have set through the UI", () => {
    const lines = hydrateCartRows(
      [{ productId: "p-mug", variantId: "v-clay", quantity: 5000 }],
      CATALOG,
    );
    assert.equal(lines[0].quantity, MAX_QUANTITY);
  });
});

describe("toCartRows", () => {
  it("round-trips a hydrated cart back to the same rows", () => {
    const rows: CartRow[] = [{ productId: "p-tee", variantId: "v-ink", quantity: 3 }];
    assert.deepEqual(toCartRows(hydrateCartRows(rows, CATALOG), CATALOG), rows);
  });

  it("falls back to the default variant when a line names none", () => {
    const rows = toCartRows(
      [
        {
          productId: "p-tee",
          name: "Everyday Cotton Tee",
          priceAmount: 1_800_000,
          imageUrl: null,
          quantity: 1,
        },
      ],
      CATALOG,
    );

    assert.equal(rows[0].variantId, "v-bone");
  });

  it("refuses to write a line whose product is not in the catalog", () => {
    const rows = toCartRows(
      [
        {
          productId: "p-gone",
          name: "Discontinued",
          priceAmount: 1,
          imageUrl: null,
          quantity: 1,
          variantId: "v-x",
        },
      ],
      CATALOG,
    );
    assert.deepEqual(rows, []);
  });
});

describe("mergeCartRows", () => {
  it("sums quantities for a product present on both sides", () => {
    const local = hydrateCartRows(
      [{ productId: "p-tee", variantId: "v-bone", quantity: 2 }],
      CATALOG,
    );
    const server: CartRow[] = [{ productId: "p-tee", variantId: "v-ink", quantity: 3 }];

    assert.deepEqual(mergeCartRows(local, server, CATALOG), [
      { productId: "p-tee", variantId: "v-bone", quantity: 5 },
    ]);
  });

  it("keeps the device's variant when the two disagree", () => {
    // Matches the reducer's rule that re-adding a product adopts the newly chosen
    // variant: the cart the shopper is looking at is the newer intent.
    const local = hydrateCartRows(
      [{ productId: "p-tee", variantId: "v-ink", quantity: 1 }],
      CATALOG,
    );
    const server: CartRow[] = [{ productId: "p-tee", variantId: "v-bone", quantity: 1 }];

    assert.equal(mergeCartRows(local, server, CATALOG)[0].variantId, "v-ink");
  });

  it("unions products that exist on only one side", () => {
    const local = hydrateCartRows(
      [{ productId: "p-mug", variantId: "v-clay", quantity: 1 }],
      CATALOG,
    );
    const server: CartRow[] = [{ productId: "p-tee", variantId: "v-bone", quantity: 4 }];

    const merged = mergeCartRows(local, server, CATALOG);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((row) => row.productId).sort(),
      ["p-mug", "p-tee"],
    );
  });

  it("caps a merged quantity at the ceiling the database enforces", () => {
    const local = hydrateCartRows(
      [{ productId: "p-tee", variantId: "v-bone", quantity: 80 }],
      CATALOG,
    );
    const server: CartRow[] = [{ productId: "p-tee", variantId: "v-ink", quantity: 80 }];

    assert.equal(mergeCartRows(local, server, CATALOG)[0].quantity, MAX_QUANTITY);
  });

  it("leaves the server cart alone when there is no device cart", () => {
    const server: CartRow[] = [{ productId: "p-tee", variantId: "v-bone", quantity: 2 }];
    assert.deepEqual(mergeCartRows([], server, CATALOG), server);
  });
});

describe("sameCartRows", () => {
  const rows: CartRow[] = [
    { productId: "p-tee", variantId: "v-bone", quantity: 1 },
    { productId: "p-mug", variantId: "v-clay", quantity: 2 },
  ];

  it("ignores ordering", () => {
    assert.equal(sameCartRows(rows, [...rows].reverse()), true);
  });

  it("notices a changed quantity", () => {
    assert.equal(
      sameCartRows(rows, [rows[0], { ...rows[1], quantity: 3 }]),
      false,
    );
  });

  it("notices a changed variant", () => {
    // The echo guard's whole job: without this, a realtime delivery of our own
    // write would be written straight back.
    assert.equal(
      sameCartRows(rows, [{ ...rows[0], variantId: "v-ink" }, rows[1]]),
      false,
    );
  });

  it("treats different lengths as different carts", () => {
    assert.equal(sameCartRows(rows, rows.slice(0, 1)), false);
  });

  it("gives two rows with identical content the same key", () => {
    assert.equal(cartRowKey(rows[0]), cartRowKey({ ...rows[0] }));
  });
});
