import "server-only";

/**
 * One outbound transactional email, independent of provider.
 *
 * Both providers accept this shape, so nothing above the transport layer knows
 * which service is configured. That keeps the switch a one-variable change.
 */
export type EmailMessage = {
  from: { email: string; name?: string };
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  tags: string[];
};

export type EmailSendResult = {
  /** Provider's own message id, recorded in email_log.provider_id. */
  providerId: string | null;
};

export type EmailSender = (
  message: EmailMessage,
  options: { idempotencyKey: string },
) => Promise<EmailSendResult>;

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ATTEMPTS = 3;

/**
 * Decides whether a status is worth repeating.
 *
 * A 400 such as a rejected parameter or a 401 means the request itself is
 * wrong: retrying only delays the email_log failure row without changing the
 * outcome.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Posts to a provider with a timeout and bounded retries.
 *
 * `send` receives the per-attempt AbortSignal and must throw `HttpStatusError`
 * for a response it could not treat as success, so this layer can classify the
 * failure without knowing anything about the provider's response shape.
 */
export async function postWithRetry(input: {
  label: string;
  idempotencyKey: string;
  attempts?: number;
  timeoutMs?: number;
  /** Retry only outcomes known not to have been accepted upstream. */
  isRetryable?: (status: number) => boolean;
  /** Whether an ambiguous transport failure (timeout, DNS, socket reset) may be retried. */
  retryOnTransportError?: boolean;
  send: (signal: AbortSignal) => Promise<Response>;
}): Promise<Response> {
  const attempts = input.attempts ?? DEFAULT_ATTEMPTS;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryable = input.isRetryable ?? isRetryableStatus;
  const retryTransport = input.retryOnTransportError ?? true;
  let lastError = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response;

    try {
      response = await input.send(AbortSignal.timeout(timeoutMs));
    } catch (caught) {
      lastError = caught instanceof Error ? caught.message : String(caught);

      // The request may or may not have landed. Only retry when the provider
      // can de-duplicate; otherwise stop and let email_log record the failure
      // so a human can resend deliberately.
      if (!retryTransport || attempt === attempts) {
        throw new Error(`${input.label} transport error: ${lastError}`);
      }

      await sleep(2 ** (attempt - 1) * 500);
      continue;
    }

    if (response.ok) return response;

    const detail = await safeText(response);

    if (!retryable(response.status) || attempt === attempts) {
      throw new HttpStatusError(
        `${input.label} failed (${response.status}): ${detail}`,
        response.status,
      );
    }

    lastError = `HTTP ${response.status}: ${detail}`;
    await sleep(2 ** (attempt - 1) * 500);
  }

  throw new Error(`${input.label} failed after ${attempts} attempt(s): ${lastError}`);
}

export class HttpStatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

/** Reads a body without letting a malformed response mask the status code. */
export async function safeText(response: Response): Promise<string> {
  try {
    const raw = await response.text();
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const message = parsed.message ?? parsed.error;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.map(String).join("; ");
    } catch {
      // Not JSON. Fall through to the raw body.
    }
    return raw.slice(0, 300);
  } catch {
    return "<unreadable response body>";
  }
}

export async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = (await response.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through.
  }
  return {};
}

export { DEFAULT_ATTEMPTS, DEFAULT_TIMEOUT_MS };