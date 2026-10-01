import "server-only";

import Stripe from "stripe";

// Hosted Checkout only. There is no Stripe.js in this project and no card data
// ever reaches our servers, which keeps the integration in the simplest PCI
// scope. Do not add a client-side Stripe package without revisiting that.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing required environment variable STRIPE_SECRET_KEY. Stripe checkout is not configured.",
    );
  }

  cached = new Stripe(secretKey, {
    // Pin the version so a Stripe-side upgrade cannot change response shapes
    // under us. Bump deliberately.
    apiVersion: "2026-09-30.endive",
    typescript: true,
  });

  return cached;
}

export function requireSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error(
      "Missing required environment variable NEXT_PUBLIC_SITE_URL. Stripe redirect URLs are built from it.",
    );
  }
  return url.replace(/\/+$/, "");
}

export function requireWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Missing required environment variable STRIPE_WEBHOOK_SECRET. Locally this comes from: stripe listen --forward-to localhost:3001/api/stripe/webhook",
    );
  }
  return secret;
}