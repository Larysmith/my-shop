import "server-only";

import {
  postWithRetry,
  safeJson,
  type EmailMessage,
  type EmailSendResult,
  type EmailSender,
} from "./provider";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Brevo email delivery is not configured.`,
    );
  }
  return value;
}

/**
 * Brevo transport.
 *
 * A send POST has a real duplicate-delivery risk: if Brevo accepts the message
 * and the response is then lost to a network fault, a naive retry mails the
 * customer a second time. Brevo de-duplicates on Idempotency-Key, so every
 * attempt at one logical send reuses the same key and a retry is safe — which
 * is why transport errors are retryable here but not for Mailgun.
 */
export const sendViaBrevo: EmailSender = async (
  message: EmailMessage,
  options: { idempotencyKey: string },
): Promise<EmailSendResult> => {
  const apiKey = requireEnv("BREVO_API_KEY");

  const response = await postWithRetry({
    label: "Brevo request",
    idempotencyKey: options.idempotencyKey,
    retryOnTransportError: true,
    send: (signal) =>
      fetch(BREVO_SEND_URL, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Idempotency-Key": options.idempotencyKey,
        },
        body: JSON.stringify({
          sender: message.from,
          to: [message.to],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          tags: message.tags,
        }),
        signal,
      }),
  });

  const parsed = await safeJson(response);
  const messageId =
    typeof parsed.messageId === "string" ? parsed.messageId : "";

  return { providerId: messageId || null };
};