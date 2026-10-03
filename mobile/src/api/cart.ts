import { getSupabase } from "./supabase";
import { cartRowKey, type CartRow } from "../shared";

/**
 * Cart reads and writes through the Supabase Data API.
 *
 * The app's own copy of what src/lib/cart/remote.ts does for the web, because that
 * module imports @supabase/supabase-js and letting Metro resolve it from the
 * repository's node_modules would load a second copy of the client beside the
 * app's. The logic worth sharing — hydration, merging, clamping — is in
 * ../shared and is not duplicated here.
 *
 * Nothing here sends an amount. Writes carry ids and a quantity only, and the
 * price is always read back from the catalog. RLS confines every read and write
 * to the caller's own rows, so these policies are the only protection on the rows
 * and the web app's proxy guard does not apply to a direct Data API call.
 */

type CartRowRecord = {
  product_id: string;
  variant_id: string;
  quantity: number;
};

export async function readCartRows(userId: string): Promise<CartRow[]> {
  const { data, error } = await getSupabase()
    .from("cart_items")
    .select("product_id, variant_id, quantity")
    .eq("user_id", userId);

  if (error) throw new Error(`cart read failed: ${error.message}`);

  return ((data ?? []) as CartRowRecord[]).map((row) => ({
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
  }));
}

/**
 * Reconciles the server to `desired`, sending only the difference.
 *
 * Reconcile rather than translate-the-operation, for the same reasons as the web
 * client: the cart is a handful of lines, so comparing the whole set is cheap, and
 * a diff that converges is far easier to reason about than a chain of increments.
 * It is also idempotent, which matters on a phone where a request can be retried
 * after the connection drops mid-write.
 */
export async function writeCartRows(
  userId: string,
  desired: CartRow[],
  current: CartRow[],
): Promise<void> {
  const supabase = getSupabase();

  const changed = desired.filter((row) => {
    const previous = current.find((candidate) => candidate.productId === row.productId);
    return (
      !previous ||
      previous.variantId !== row.variantId ||
      previous.quantity !== row.quantity
    );
  });

  const desiredProducts = new Set(desired.map((row) => row.productId));
  const removed = current
    .filter((row) => !desiredProducts.has(row.productId))
    .map((row) => row.productId);

  if (changed.length > 0) {
    const { error } = await supabase.from("cart_items").upsert(
      changed.map((row) => ({
        user_id: userId,
        product_id: row.productId,
        variant_id: row.variantId,
        quantity: row.quantity,
      })),
      { onConflict: "user_id,product_id" },
    );
    if (error) throw new Error(`cart write failed: ${error.message}`);
  }

  if (removed.length > 0) {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .in("product_id", removed);
    if (error) throw new Error(`cart remove failed: ${error.message}`);
  }
}

/** Whether two row sets describe the same cart, ignoring order. */
export function sameCartRows(a: CartRow[], b: CartRow[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(cartRowKey).sort();
  const right = b.map(cartRowKey).sort();
  return left.every((key, index) => key === right[index]);
}

/**
 * Subscribes to this user's cart rows, calling `onChange` on any change.
 *
 * RLS is re-checked per event by Realtime, so the filter is a narrowing rather
 * than the access control. DELETE arrives with the old record, which is why the
 * select grant on cart_items matters.
 */
export function subscribeToCart(userId: string, onChange: () => void) {
  return getSupabase()
    .channel(`cart:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cart_items",
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();
}
