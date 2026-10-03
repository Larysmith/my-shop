import type { CartLine } from "./types";

export { clampQuantity, MAX_QUANTITY } from "./quantity";

const STORAGE_KEY = "lary-shop.cart.v1";

type PersistedCart = { version: 1; lines: CartLine[] };

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.productId === "string" &&
    typeof line.name === "string" &&
    typeof line.priceAmount === "number" &&
    typeof line.quantity === "number" &&
    line.quantity > 0 &&
    (typeof line.imageUrl === "string" || line.imageUrl === null)
  );
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as PersistedCart).version !== 1 ||
      !Array.isArray((parsed as PersistedCart).lines)
    ) {
      return [];
    }

    return (parsed as PersistedCart).lines.filter(isCartLine);
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]): void {
  if (typeof window === "undefined") return;

  try {
    const payload: PersistedCart = { version: 1, lines };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
}
