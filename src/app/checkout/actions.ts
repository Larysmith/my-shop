"use server";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe, requireSiteUrl } from "@/lib/server/stripe/client";
import { computeTotals } from "@/lib/pricing";
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

export async function startStripeCheckout(
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
    .select("id, title, sku, price_cents, stock, is_active, products (name)")
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

  const { shippingCents, totalCents } = computeTotals(
    priced.map((entry) => ({
      priceCents: entry.variant.price_cents,
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
    p_shipping_cents: shippingCents,
  });

  if (orderError || !order) {
    console.error("create_pending_order failed", orderError?.message);
    return bad(orderError?.message ?? "Could not start the order.");
  }

  const pending = order as { id: string; order_number: string; total_cents: number };

  if (pending.total_cents !== totalCents) {
    // The RPC prices from the same rows we just read, so this should be
    // impossible. If it ever fires, do not take the money.
    console.error(
      `total mismatch on ${pending.order_number}: rpc=${pending.total_cents} local=${totalCents}`,
    );
    return bad("Your cart changed while you were checking out. Please review it.");
  }

  const siteUrl = requireSiteUrl();
  const currency = "usd";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      // The order number is the join key the webhook uses to find the order.
      metadata: { orderNumber: pending.order_number },
      payment_intent_data: {
        metadata: { orderNumber: pending.order_number },
      },
      customer_email: input.email.trim(),
      line_items: priced.map((entry) => ({
        quantity: entry.quantity,
        // price_data rather than a stored Price id: the catalog is the source
        // of truth and one Stripe Price per variant is not provisioned yet.
        price_data: {
          currency,
          unit_amount: entry.variant.price_cents,
          product_data: {
            name: entry.variant.productName,
            description: [entry.variant.title, entry.variant.sku]
              .filter(Boolean)
              .join(" · "),
          },
        },
      })),
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: shippingCents === 0 ? "Free shipping" : "Flat rate",
            fixed_amount: { amount: shippingCents, currency },
          },
        },
      ],
      success_url: `${siteUrl}/checkout/success?order=${encodeURIComponent(pending.order_number)}`,
      cancel_url: `${siteUrl}/checkout?canceled=1`,
    });

    const { error: linkError } = await supabase
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", pending.id);

    if (linkError) {
      console.error("could not store session id", linkError.message);
    }

    if (!session.url) {
      return bad("Stripe did not return a checkout URL.");
    }

    return { ok: true, url: session.url };
  } catch (caught) {
    console.error(
      "stripe checkout.sessions.create failed",
      caught instanceof Error ? caught.message : String(caught),
    );
    return bad("We could not reach the payment provider. Please try again.");
  }
}

type VariantRow = {
  id: string;
  title: string;
  sku: string;
  price_cents: number;
  stock: number;
  is_active: boolean;
  products: { name: string } | null;
  productName: string;
};