import "server-only";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

type BrevoSendRequest = {
  sender: { email: string; name?: string };
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name?: string };
  tags?: string[];
};

type BrevoSendResponse = {
  messageId?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Brevo email delivery is not configured.`,
    );
  }
  return value;
}

export type BrevoSendResult = {
  messageId: string | null;
};

// A send POST has a real duplicate-delivery risk: if Brevo accepts the message
// and the response is then lost to a network fault, a naive retry mails the
// customer a second time. Brevo de-duplicates on Idempotency-Key, so every
// attempt at one logical send reuses the same key and a retry is safe.
export type BrevoSendOptions = {
  idempotencyKey: string;
  attempts?: number;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ATTEMPTS = 3;

// Retry only what is plausibly transient. A 400 such as invalid_parameter or a
// 401 means the request itself is wrong, and repeating it just delays the
// email_log failure row without changing the outcome.
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendViaBrevo(
  request: BrevoSendRequest,
  options: BrevoSendOptions,
): Promise<BrevoSendResult> {
  const apiKey = requireEnv("BREVO_API_KEY");
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const body = JSON.stringify(request);

  let lastError = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(BREVO_SEND_URL, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Idempotency-Key": options.idempotencyKey,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (caught) {
      // Network fault or timeout. The send may or may not have landed, which
      // is exactly why the idempotency key is sent on every attempt.
      lastError =
        caught instanceof Error ? caught.message : String(caught);
      if (attempt < attempts) {
        await sleep(2 ** (attempt - 1) * 500);
        continue;
      }
      throw new Error(
        `Brevo request failed after ${attempts} attempt(s): ${lastError}`,
      );
    }

    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    // 201 = sent, 202 = scheduled. Both mean Brevo accepted the message.
    if (response.status === 201 || response.status === 202) {
      const messageId =
        parsed && typeof parsed === "object" && "messageId" in parsed
          ? String((parsed as BrevoSendResponse).messageId ?? "")
          : "";
      return { messageId: messageId || null };
    }

    let detail = raw;
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      detail = String((parsed as { message: unknown }).message);
    }

    if (!isRetryableStatus(response.status) || attempt === attempts) {
      throw new Error(`Brevo request failed (${response.status}): ${detail}`);
    }

    lastError = `HTTP ${response.status}: ${detail}`;
    await sleep(2 ** (attempt - 1) * 500);
  }

  throw new Error(`Brevo request failed after ${attempts} attempt(s): ${lastError}`);
}