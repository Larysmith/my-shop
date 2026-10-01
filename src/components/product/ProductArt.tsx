import type { Product } from "@/lib/catalog";

// Flat vector product artwork. Inline SVG rather than files in /public/products
// so it stays crisp at any size, needs no image-optimizer config, and can take
// the selected variant's swatch as its fill.
//
// Deliberately not a client component: server components (ProductCard,
// ProductImage) render this and must be able to call artForProduct directly. It
// uses no hooks, and the gradient id is derived from the art kind rather than
// useId, so the same artwork can be rendered on the server and the client.
// Sharing one gradient id across repeats is harmless because the definition is
// identical in every instance.
export type ArtKind =
  | "tee"
  | "hoodie"
  | "tote"
  | "mug"
  | "blanket"
  | "wallet"
  | "lamp"
  | "socks";

// Keyed on slug, which is the only identifier that is stable across the demo
// catalog and the Postgres rows (whose ids are generated UUIDs). The legacy
// p-00X demo ids are kept as aliases because cart lines persisted in
// localStorage still carry productId and nothing rewrites them on load.
const ART_BY_SLUG: Record<string, ArtKind> = {
  "everyday-cotton-tee": "tee",
  "heavyweight-hoodie": "hoodie",
  "canvas-tote-bag": "tote",
  "ceramic-pour-over-mug": "mug",
  "linen-throw-blanket": "blanket",
  "leather-card-wallet": "wallet",
  "minimal-desk-lamp": "lamp",
  "merino-wool-socks": "socks",
};

const LEGACY_ART_BY_ID: Record<string, ArtKind> = {
  "p-001": "tee",
  "p-002": "hoodie",
  "p-003": "tote",
  "p-004": "mug",
  "p-005": "blanket",
  "p-006": "wallet",
  "p-007": "lamp",
  "p-008": "socks",
};

/**
 * Accepts a slug, a legacy demo id, or a product name, because callers hold
 * different identifiers: the PDP has the whole product, the cart line only has
 * whatever was written to localStorage, and Postgres rows expose a slug.
 */
export function artForProduct(identifier: string): ArtKind {
  const key = identifier.trim().toLowerCase();
  return (
    ART_BY_SLUG[key] ??
    LEGACY_ART_BY_ID[key] ??
    ART_BY_SLUG[key.replace(/[\s_]+/g, "-")] ??
    "tee"
  );
}

type Props = {
  kind: ArtKind;
  swatch: string;
  className?: string;
};

export default function ProductArt({ kind, swatch, className = "" }: Props) {
  const fade = `lary-fade-${kind}`;

  return (
    <svg
      viewBox="0 0 200 200"
      className={`size-full ${className}`}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={fade} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      <rect width="200" height="200" fill={swatch} />
      <rect width="200" height="200" fill={`url(#${fade})`} />

      <g fill="none" stroke="#1c1c1e" strokeOpacity="0.62" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        {renderArt(kind)}
      </g>
    </svg>
  );
}

function renderArt(kind: ArtKind) {
  switch (kind) {
    case "tee":
      return (
        <>
          <path d="M74 56h52l20 12-10 18-10-5v58H74V81l-10 5-10-18z" fill="#fff" fillOpacity="0.34" />
          <path d="M86 56c2 8 7 12 14 12s12-4 14-12" />
          <path d="M84 139h32" strokeOpacity="0.28" />
        </>
      );

    case "hoodie":
      return (
        <>
          <path d="M76 60c6-8 14-12 24-12s18 4 24 12l18 10-9 20-9-5v56H76V75l-9 5-9-20z" fill="#fff" fillOpacity="0.32" />
          <path d="M88 54c3 10 8 16 12 16s9-6 12-16" />
          <path d="M78 124h44" strokeOpacity="0.3" />
          <path d="M86 126c0 10 6 16 14 16s14-6 14-16" />
        </>
      );

    case "tote":
      return (
        <>
          <path d="M62 74h76l-6 62H68z" fill="#fff" fillOpacity="0.34" />
          <path d="M84 74V58a16 16 0 0 1 32 0v16" />
          <path d="M68 96h64" strokeOpacity="0.26" />
        </>
      );

    case "mug":
      return (
        <>
          <path d="M70 74h50v56a14 14 0 0 1-14 14H84a14 14 0 0 1-14-14z" fill="#fff" fillOpacity="0.34" />
          <path d="M120 86h12a12 12 0 0 1 0 24h-12" />
          <path d="M70 86h50" strokeOpacity="0.26" />
          <path d="M86 64c0-6 6-6 6-12M104 64c0-6 6-6 6-12" strokeOpacity="0.4" />
        </>
      );

    case "blanket":
      return (
        <>
          <path d="M52 70h96v64H52z" fill="#fff" fillOpacity="0.32" />
          <path d="M52 84h96M52 106h96M52 122h96" strokeOpacity="0.24" />
          <path d="M60 134v8M76 134v8M92 134v8M108 134v8M124 134v8M140 134v8" strokeOpacity="0.3" />
        </>
      );

    case "wallet":
      return (
        <>
          <path d="M56 76h88v52H56z" fill="#fff" fillOpacity="0.34" />
          <path d="M56 90h88" strokeOpacity="0.24" />
          <path d="M74 68h40v10H74z" fill="#fff" fillOpacity="0.5" />
          <path d="M74 96h34M74 108h26" strokeOpacity="0.26" />
          <circle cx="132" cy="102" r="5" />
        </>
      );

    case "lamp":
      return (
        <>
          <path d="M76 62h48l12 22H64z" fill="#fff" fillOpacity="0.34" />
          <path d="M100 84v56" />
          <path d="M78 140h44" />
          <path d="M112 132h20a6 6 0 0 0 0-12h-8" strokeOpacity="0.4" />
          <path d="M78 84l-8 34M122 84l8 34" strokeOpacity="0.22" strokeDasharray="3 5" />
        </>
      );

    case "socks":
      return (
        <>
          <path d="M74 52h26v52l24 24a14 14 0 1 1-20 20l-30-30V52z" fill="#fff" fillOpacity="0.34" />
          <path d="M74 66h26" strokeOpacity="0.28" />
          <path d="M112 128l18 18" strokeOpacity="0.2" />
        </>
      );
  }
}

/** Convenience wrapper that picks the art for a product. */
export function ProductArtForProduct({
  product,
  swatch,
}: {
  product: Pick<Product, "slug">;
  swatch: string;
}) {
  return <ProductArt kind={artForProduct(product.slug)} swatch={swatch} />;
}