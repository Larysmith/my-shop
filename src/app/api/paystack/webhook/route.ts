import { NextResponse } from "next/server";
import { isValidPaystackSignature } from "@/lib/server/paystack/signature";
import { requireWebhookSecret, verifyTransaction } from "@/lib/server/paystack/client";
import { fulfillPaidOrder } from "@/lib/server/orders/fulfill";

// Signature verification needs the unparsed body, so this route must not be
// statically optimized and must read the raw text itself.
export const dynamic = "force-dynamic";

type PaystackWebhookEvent = {
  event?: string;
  data?: { reference?: string; reference_on_transaction?: string };
};

export async function POST(request: Request) {
  const signature = request.headers.get("x-paystack-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing x-paystack-signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let secret: string;
  try {
    secret = requireWebhookSecret();
  } catch (caught) {
    console.error("paystack webhook secret missing:", caught instanceof Error ? caught.message : caught);
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!isValidPaystackSignature(rawBody, signature, secret)) {
    // Never echo the expected value: that would hand an attacker the secret.
    console.error("paystack webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true, ignored: event.event ?? "unknown" });
  }

  const reference =
    event.data?.reference_on_transaction ?? event.data?.reference ?? null;

  if (!reference) {
    // Without this the charge cannot be matched to an order, and guessing would
    // risk crediting the wrong one.
    console.error("paystack charge.success carried no reference");
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    // The webhook says a charge succeeded. Paystack's own guidance is to confirm
    // against the transaction record rather than trusting the notification: a
    // card payment can notify before it settles, and a delivery can be replayed.
    // Fulfillment is therefore based on this verified result, not on the body.
    const transaction = await verifyTransaction(reference);

    const result = await fulfillPaidOrder({
      reference,
      // The webhook carries no order number, so the reference column is the only
      // key available. The order is located by its stored paystack_reference.
      paid: transaction.status === "success",
      chargedAmount: transaction.amount,
    });

    return NextResponse.json({ received: true, ...result });
  } catch (caught) {
    // A 500 makes Paystack retry, which is what we want for a transient fault.
    // A deliberate refusal (amount mismatch) also lands here and is retried, so
    // it stays visible in the logs rather than being silently swallowed.
    console.error(
      `fulfillment failed for reference ${reference}`,
      caught instanceof Error ? caught.message : String(caught),
    );
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }
}

/**
 * Paystack verifies webhook delivery by GETting the URL, so this must answer
 * rather than 405. It leaks nothing.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}