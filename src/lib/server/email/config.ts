import "server-only";

import { sendViaBrevo } from "./brevo";
import { sendViaMailgun } from "./mailgun";
import type { EmailSender } from "./provider";

export type ResolvedProvider = {
  sender: EmailSender;
  name: string;
  /** Variable holding the verified From address for this provider. */
  fromEmailVariable: string;
  fromName?: string;
};

/**
 * Picks the transport named by EMAIL_PROVIDER.
 *
 * Unset is a configuration error rather than defaulting to a provider: silently
 * choosing one could start sending real customer email from an account nobody
 * meant to use. `none` is the explicit way to turn delivery off, and callers
 * still record a failed email_log row so the gap stays auditable.
 *
 * Returns null for "none" rather than throwing, because refusing to send is a
 * supported configuration, not an error.
 */
/**
 * The subset of the environment this module reads.
 *
 * Deliberately not `NodeJS.ProcessEnv`: that type requires NODE_ENV, which
 * would force callers and tests to fabricate unrelated variables just to select
 * a provider.
 */
export type EmailEnv = Record<string, string | undefined>;

export function resolveProvider(env: EmailEnv = process.env): ResolvedProvider | null {
  const provider = env.EMAIL_PROVIDER;

  if (!provider) {
    throw new Error(
      "Missing required environment variable EMAIL_PROVIDER. Set it to one of: brevo, mailgun, none.",
    );
  }

  switch (provider.trim().toLowerCase()) {
    case "brevo":
      return {
        sender: sendViaBrevo,
        name: "Brevo",
        fromEmailVariable: "BREVO_FROM_EMAIL",
        fromName: env.BREVO_FROM_NAME,
      };
    case "mailgun":
      return {
        sender: sendViaMailgun,
        name: "Mailgun",
        fromEmailVariable: "MAILGUN_FROM_EMAIL",
        fromName: env.MAILGUN_FROM_NAME,
      };
    case "none":
      return null;
    default:
      throw new Error(
        `EMAIL_PROVIDER is "${provider}", which is not a known provider. Use one of: brevo, mailgun, none.`,
      );
  }
}