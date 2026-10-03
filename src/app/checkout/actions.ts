"use server";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/server/paystack/client";
import { signOrderToken } from "@/lib/server/orders/view-token";
import { requireSiteUrl } from "@/lib/server/site-url";
import { MissingEnvError, requireEnv } from "@/lib/server/env";
import { computeTotals, SHOP_CURRENCY } from "@/lib/pricing";
import type { CartLine } from "@/lib/cart/types";

export type StartCheckoutInput = {
  email: string;
  shipping: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
  };
  customerNotes?: string;
  lines: CartLine[];
};

export type StartCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function bad(message: string): StartCheckoutResult {
  return { ok: false, error: message };
}

export async function startPaystackCheckout(
  input: StartCheckoutInput,
): Promise<StartCheckoutResult> {
  if (input.lines.length === 0) return bad("Your cart is empty.");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return bad("Enter a valid email address.");
  }

  const variantIds = input.lines.map((line) => line.variantId);
  if (variantIds.some((id) => !id)) {
    return bad("A product in your cart has no selected variant.");
  }

  const supabase = createAdminClient();

  // Re-read every variant and re-derive the totals server-side. Nothing about
  // price, stock or name is trusted from the client: the cart lives in
  // localStorage and can be edited freely.
  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select("id, title, sku, price_amount, stock, is_active, products (name)")
    .in("id", variantIds as string[]);

  if (variantError) {
    console.error("variant read failed", variantError.message);
    return bad("We could not verify your cart. Please try again.");
  }

  const byId = new Map(
    (variants ?? []).map((row) => {
      const variant = row as unknown as VariantRow;
      return [
        variant.id,
        { ...variant, productName: variant.products?.name ?? "Product" },
      ] as const;
    }),
  );

  const priced = [];
  for (const line of input.lines) {
    const variant = byId.get(line.variantId as string);
    if (!variant || !variant.is_active) {
      return bad("A product in your cart is no longer available.");
    }
    if (variant.stock < line.quantity) {
      return bad(`${variant.productName} does not have enough stock left.`);
    }
    priced.push({ variant, quantity: line.quantity });
  }

  const { shippingAmount, totalAmount } = computeTotals(
    priced.map((entry) => ({
      priceAmount: entry.variant.price_amount,
      quantity: entry.quantity,
    })),
  );

  const { data: userData } = await (await createClient()).auth.getUser();
  const userId = userData?.user?.id ?? null;

  const cartHash = createHash("sha256")
    .update(
      JSON.stringify(
        priced
          .map((entry) => [entry.variant.id, entry.quantity])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ),
    )
    .digest("hex");

  // Configuration is checked before a single row is written.
  //
  // This used to run after `create_pending_order`, so a deploy missing
  // NEXT_PUBLIC_SITE_URL or PAYSTACK_SECRET_KEY left an orphan pending order on
  // every attempt: five of them, all with no paystack_reference, which is the
  // signature of exactly this failure. It also threw outside the try/catch, so the
  // Server Action surfaced a generic error instead of saying what was wrong.
  let siteUrl: string;
  try {
    siteUrl = requireSiteUrl();
    requireEnv("PAYSTACK_SECRET_KEY");
  } catch (caught) {
    if (caught instanceof MissingEnvError) {
      console.error(`checkout blocked: ${caught.message}`);
      return bad(
        `Payments are not configured on this deployment (${caught.variables.join(", ")}). ` +
          `Set the variable and try again.`,
      );
    }
    throw caught;
  }

  const { data: order, error: orderError } = await supabase.rpc("create_pending_order", {
    p_email: input.email.trim(),
    p_shipping: {
      name: input.shipping.name.trim(),
      line1: input.shipping.line1.trim(),
      line2: input.shipping.line2?.trim() || null,
      city: input.shipping.city.trim(),
      region: input.shipping.region?.trim() || null,
      postalCode: input.shipping.postalCode?.trim() || null,
      country: input.shipping.country.trim().toUpperCase(),
    },
    p_user_id: userId,
    p_cart_hash: cartHash,
    p_lines: priced.map((entry) => ({
      variantId: entry.variant.id,
      quantity: entry.quantity,
    })),
    p_shipping_amount: shippingAmount,
  });

  if (orderError || !order) {
    console.error("create_pending_order failed", orderError?.message);
    return bad(orderError?.message ?? "Could not start the order.");
  }

  const pending = order as { id: string; order_number: string; total_amount: number };

  if (pending.total_amount !== totalAmount) {
    // The RPC prices from the same rows we just read, so this should be
    // impossible. If it ever fires, do not take the money.
    console.error(
      `total mismatch on ${pending.order_number}: rpc=${pending.total_amount} local=${totalAmount}`,
    );
    return bad("Your cart changed while you were checking out. Please review it.");
  }

  // The reference is generated here, before the provider is called, so the order
  // row and the Paystack transaction share one value. If the call below fails
  // ambiguously, that reference is still enough to find out what happened
  // instead of leaving the customer with an unknown payment.
  //
  // `order_number` already carries the LS- prefix, so it is not repeated here.
  // The random suffix keeps the reference unique if an order is ever re-entered
  // at checkout, which would otherwise reuse the same value.
  const reference = `${pending.order_number}-${randomBytes(6).toString("hex")}`;

  try {
    const transaction = await initializeTransaction({
      reference,
      amount: totalAmount,
      currency: SHOP_CURRENCY,
      email: input.email.trim(),
      // The token, not the bare order number, is what the success page accepts.
      // Order numbers are not secret — they are printed in emails — so passing
      // one alone would let anyone who saw it read the order. See view-token.ts.
      callbackUrl: `${siteUrl}/checkout/success?token=${encodeURIComponent(
        signOrderToken(pending.order_number),
      )}`,
      metadata: {
        orderNumber: pending.order_number,
        orderId: pending.id,
        // Recorded so the paystack console is legible when reconciling.
        cart: priced
          .map((entry) => `${entry.variant.productName} x${entry.quantity}`)
          .join(", ")
          .slice(0, 500),
      },
    });

    const { error: linkError } = await supabase
      .from("orders")
      .update({ paystack_reference: transaction.reference })
      .eq("id", pending.id);

    if (linkError) {
      console.error("could not store paystack reference", linkError.message);
    }

    return { ok: true, url: transaction.authorizationUrl };
  } catch (caught) {
    console.error(
      "paystack transaction/initialize failed",
      caught instanceof Error ? caught.message : String(caught),
    );
    return bad("We could not reach the payment provider. Please try again.");
  }
}

type VariantRow = {
  id: string;
  title: string;
  sku: string;
  price_amount: number;
  stock: number;
  is_active: boolean;
  products: { name: string } | null;
  productName: string;
};