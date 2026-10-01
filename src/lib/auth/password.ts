/**
 * The Supabase project's `password_min_length`, read from its auth config.
 *
 * Every form that sets a password must use this, so the UI is never stricter
 * than the server. A form that rejects a 6-character password the server would
 * have accepted reads as a bug rather than a rule.
 *
 * The real minimum is a security decision made in the Supabase dashboard
 * (Authentication → Policies / Providers). Raise this constant at the same time,
 * never on its own.
 */
export const PASSWORD_MIN_LENGTH = 6;

/**
 * Guidance for the field, kept beside the number so the two cannot drift.
 *
 * 6 is genuinely weak. This is stated to the user rather than hidden, because a
 * silently weak minimum is a worse outcome than a slightly longer form.
 */
export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters. Consider a passphrase.`;