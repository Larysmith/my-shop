import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { cartRowKey, type CartRow } from "./hydrate";

/**
 * Reading and writing the cart through the Supabase Data API.
 *
 * There is no server route for this. The client carries the user's own JWT and
 * RLS confines it to `user_id = auth.uid()`, so a round trip through Next.js
 * would add a hop without adding a check. The consequence to keep in mind: the
 * policies in 0010_cart_rls.sql are the only thing protecting these rows, since
 * the publishable key is public by design and the web app's proxy guard does not
 * apply to a direct Data API request.
 *
 * Nothing here sends an amount. Writes carry ids and a quantity only; prices are
 * always read back from the catalog.
 */

type CartRowRecord = {
  product_id: string;
  variant_id: string;
  quantity: number;
};

export async function readCartRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<CartRow[]> {
  const { data, error } = await supabase
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
 * Reconcile-to-desired rather than translate-the-operation: the cart holds a
 * handful of lines, so the whole set is cheap to compare, and a diff that
 * converges is far easier to reason about than a chain of increments that can
 * drift out of order or double-apply. It is also idempotent, which matters
 * because a write can be retried after a dropped socket.
 */
export async function writeCartRows(
  supabase: SupabaseClient,
  userId: string,
  desired: CartRow[],
  current: CartRow[],
): Promise<void> {
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
 * Subscribes to changes on this user's cart rows.
 *
 * RLS is re-checked by Realtime per event, so the filter is belt and braces
 * rather than the access control. DELETE is delivered with the old record, which
 * is why the select grant in 0011 matters.
 */
export function subscribeToCart(
  supabase: SupabaseClient,
  userId: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
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
