import "server-only";

import {
  postWithRetry,
  safeJson,
  type EmailMessage,
  type EmailSendResult,
  type EmailSender,
} from "./provider";

/**
 * Mailgun transport.
 *
 * Two behavioural differences from Brevo are deliberate, not oversights:
 *
 * 1. Base URL is configurable. Mailgun runs separate US and EU regions and the
 *    API host differs between them; picking the wrong one returns 404 rather
 *    than an authentication error, which is a confusing way to discover it.
 *
 * 2. Transport failures are NOT retried. Mailgun documents no idempotency key
 *    for sends, so a retry after an ambiguous timeout could deliver a second
 *    copy of an order confirmation. A lost email is recoverable — it is written
 *    to email_log as failed and can be resent deliberately — whereas a duplicate
 *    goes to a real customer and cannot be recalled. Only a 429 is retried,
 *    because that is rejected rather than queued.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Mailgun email delivery is not configured.`,
    );
  }
  return value;
}

function mailgunSendUrl(domain: string): string {
  // US default is https://api.mailgun.net; EU accounts use api.eu.mailgun.net.
  const base = (process.env.MAILGUN_API_BASE ?? "https://api.mailgun.net").replace(
    /\/+$/,
    "",
  );
  return `${base}/v3/${encodeURIComponent(domain)}/messages`;
}

export const sendViaMailgun: EmailSender = async (
  message: EmailMessage,
): Promise<EmailSendResult> => {
  const apiKey = requireEnv("MAILGUN_API_KEY");
  const domain = requireEnv("MAILGUN_DOMAIN");

  const from = message.from.name
    ? `${message.from.name} <${message.from.email}>`
    : message.from.email;
  const to = message.to.name
    ? `${message.to.name} <${message.to.email}>`
    : message.to.email;

  // form-encoded rather than multipart: no attachments are used, and this keeps
  // the body readable in Mailgun's request logs.
  const body = new URLSearchParams({
    from,
    to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  // Mailgun tags enable per-template filtering in the dashboard. o:tag is the
  // documented wire name for them.
  for (const tag of message.tags) {
    body.append("o:tag", tag);
  }

  const response = await postWithRetry({
    label: "Mailgun request",
    idempotencyKey: "",
    // Only a rate-limit rejection is provably unsent.
    isRetryable: (status) => status === 429,
    retryOnTransportError: false,
    send: (signal) =>
      fetch(mailgunSendUrl(domain), {
        method: "POST",
        headers: {
          // Mailgun authenticates as the literal user "api" with the API key.
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal,
      }),
  });

  const parsed = await safeJson(response);
  const id = typeof parsed.id === "string" ? parsed.id : "";

  return { providerId: id || null };
};