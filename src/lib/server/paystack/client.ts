import "server-only";

/**
 * Paystack REST client.
 *
 * Paystack has no official server SDK worth depending on: the API surface used
 * here is two endpoints. A hand-written client also keeps the payload handling
 * explicit, which matters because a payment response is the one place where a
 * silently malformed field becomes a money bug.
 *
 * Base URL is https://api.paystack.co. Amounts are integer kobo.
 */
const PAYSTACK_BASE = "https://api.paystack.co";

export type PaystackInitializeResult = {
  /** Unique per attempt. Stored on the order and used as the idempotency key. */
  reference: string;
  /** Hosted page to redirect the customer to. */
  authorizationUrl: string;
  accessCode: string;
};

export type PaystackVerifiedTransaction = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  email: string;
  paidAt: string | null;
  referenceOnTransaction: string | null;
};

export class PaystackError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
  }
}

export function requireSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Missing required environment variable PAYSTACK_SECRET_KEY. Paystack payments are not configured.",
    );
  }
  return key;
}

export function requireWebhookSecret(): string {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Missing required environment variable PAYSTACK_WEBHOOK_SECRET. Paystack webhooks cannot be verified.",
    );
  }
  return secret;
}

async function paystackFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => null)) as
    | { status?: boolean; message?: string; data?: T }
    | null;

  if (!response.ok || body?.status === false) {
    throw new PaystackError(
      `Paystack ${path} failed (${response.status}): ${body?.message ?? "unknown error"}`,
      response.status,
    );
  }

  if (body?.data === undefined) {
    throw new PaystackError(`Paystack ${path} returned no data`, response.status);
  }

  return body.data;
}

/**
 * Creates a transaction and returns the hosted payment URL.
 *
 * `reference` is supplied rather than generated here so the order row and the
 * Paystack transaction share one value. If this call succeeds but the response
 * is lost, the reference can still be reused to verify what happened instead of
 * stranding the customer with an unknown payment.
 */
export async function initializeTransaction(input: {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<PaystackInitializeResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    // Paystack rejects a float outright, but rounding here would be worse: a
    // non-integer total means a pricing bug upstream, and quietly charging a
    // nearby amount hides it instead of surfacing it.
    throw new PaystackError(
      `Paystack amount must be a positive integer of kobo, received ${input.amount}`,
      500,
    );
  }

  const data = await paystackFetch<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      reference: input.reference,
      // Minor units, integer. Verified above rather than rounded.
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  if (!data.authorization_url) {
    throw new PaystackError("Paystack returned no authorization_url", 502);
  }

  return {
    reference: data.reference,
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code ?? "",
  };
}

/**
 * Re-reads a transaction from Paystack.
 *
 * The webhook is the primary signal, but Paystack's own guidance is to verify the
 * reference server-side as well: a webhook can be lost, delayed, or replayed, and
 * a card-payment notification can arrive before the charge has actually settled.
 * Fulfillment should therefore be based on this call, not on the webhook body.
 */
export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifiedTransaction> {
  const data = await paystackFetch<{
    reference: string;
    status: string;
    amount: number;
    currency: string;
    email: string;
    paid_at: string | null;
    transaction?: { reference?: string } | null;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });

  return {
    reference: data.reference,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    email: data.email,
    paidAt: data.paid_at,
    // The transaction id, distinct from our reference, when Paystack includes it.
    referenceOnTransaction: data.transaction?.reference ?? null,
  };
}