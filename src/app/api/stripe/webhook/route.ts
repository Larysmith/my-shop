import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, requireWebhookSecret } from "@/lib/server/stripe/client";
import { fulfillPaidOrder, type OrderIdempotencyEvent } from "@/lib/server/orders/fulfill";

// Signature verification needs the unparsed body, so this route must not be
// statically optimized and must read the raw text itself.
export const dynamic = "force-dynamic";

type HandledEvent = OrderIdempotencyEvent;

const HANDLED = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

function isHandled(type: string): type is HandledEvent {
  return HANDLED.has(type);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      requireWebhookSecret(),
    );
  } catch (caught) {
    // Never echo the underlying message: it can carry payload fragments.
    console.error(
      "stripe webhook signature verification failed",
      caught instanceof Error ? caught.message : String(caught),
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!isHandled(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderNumber = session.metadata?.orderNumber;

  if (!orderNumber) {
    // Without this the event cannot be matched to an order, and guessing would
    // risk crediting the wrong one.
    console.error(`stripe event ${event.id} has no orderNumber metadata`);
    return NextResponse.json({ error: "Missing order metadata" }, { status: 400 });
  }

  try {
    const result = await fulfillPaidOrder({
      eventId: event.id,
      sessionId: session.id,
      orderNumber,
      event: event.type,
    });

    return NextResponse.json({ received: true, ...result });
  } catch (caught) {
    // A 500 makes Stripe retry, which is what we want for a transient fault.
    console.error(
      `fulfillment failed for ${orderNumber}`,
      caught instanceof Error ? caught.message : String(caught),
    );
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }
}