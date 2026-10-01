import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { resolveProvider } from "./config";
import {
  recipientFor,
  renderEmail,
  type EmailOrder,
  type EmailTemplate,
} from "./templates";

export type SendOrderEmailResult = {
  status: "sent" | "failed";
  providerId: string | null;
  error: string | null;
};

/**
 * Renders an order email and hands it to the configured provider, then records
 * the attempt in `email_log` whatever the outcome. A delivery failure must never
 * throw into the caller's transaction — the caller is usually a Paystack webhook
 * or an order status update, and losing that work because an email failed would
 * be worse than a missing email.
 */
export async function sendOrderEmail(input: {
  orderId: string | null;
  template: EmailTemplate;
  order: EmailOrder;
}): Promise<SendOrderEmailResult> {
  const { orderId, template, order } = input;

  let status: SendOrderEmailResult["status"] = "failed";
  let providerId: string | null = null;
  let error: string | null = null;

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      throw new Error(
        "Missing required environment variable NEXT_PUBLIC_SITE_URL. Email links cannot be built.",
      );
    }

    const toCustomer =
      template === "order_confirmation" || template === "order_shipped";

    const merchantEmail = toCustomer
      ? ""
      : (process.env.MERCHANT_NOTIFICATION_EMAIL ?? "");

    if (!toCustomer && !merchantEmail) {
      throw new Error(
        "Missing required environment variable MERCHANT_NOTIFICATION_EMAIL for store owner notifications.",
      );
    }

    const rendered = renderEmail(template, order, siteUrl);
    const to = recipientFor(template, order, merchantEmail);

    const provider = resolveProvider();
    if (!provider) {
      throw new Error(
        "Email delivery is disabled (EMAIL_PROVIDER=none). No message was sent.",
      );
    }

    // A fresh key per call: retries inside the transport reuse it, so an
    // ambiguous failure cannot double-send, while an intentional resend of the
    // same template still produces a genuinely new message.
    const result = await provider.sender(
      {
        from: {
          email: requireSenderEmail(provider.fromEmailVariable, provider.name),
          name: provider.fromName || undefined,
        },
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: [template, "order-email"],
      },
      { idempotencyKey: crypto.randomUUID() },
    );

    status = "sent";
    providerId = result.providerId;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  await logAttempt({ orderId, template, order, status, providerId, error });

  return { status, providerId, error };
}

function requireSenderEmail(variable: string, providerName: string): string {
  const email = process.env[variable];
  if (!email) {
    throw new Error(
      `Missing required environment variable ${variable}. It must be verified in ${providerName}.`,
    );
  }
  return email;
}

async function logAttempt(input: {
  orderId: string | null;
  template: EmailTemplate;
  order: EmailOrder;
  status: SendOrderEmailResult["status"];
  providerId: string | null;
  error: string | null;
}): Promise<void> {
  const { orderId, template, order, status, providerId, error } = input;

  const toCustomer =
    template === "order_confirmation" || template === "order_shipped";

  const toEmail = toCustomer
    ? order.email
    : (process.env.MERCHANT_NOTIFICATION_EMAIL ?? "");

  try {
    const supabase = createAdminClient();
    const { error: insertError } = await supabase.from("email_log").insert({
      order_id: orderId,
      template,
      to_email: toEmail,
      provider_id: providerId,
      status,
      error,
    });

    if (insertError) {
      console.error("email_log insert failed", insertError.message);
    }
  } catch (caught) {
    // The send already happened; losing its audit row must not mask that.
    console.error(
      "email_log write threw",
      caught instanceof Error ? caught.message : String(caught),
    );
  }
}