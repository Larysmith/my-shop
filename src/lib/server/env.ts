/**
 * Environment variable reads that fail loudly and specifically.
 *
 * A bare `process.env.FOO!` turns a missing variable into a confusing crash three
 * frames away — either a Supabase assertion deep in the client library, or a
 * `fetch` to `undefined` that only fails on the first request in production. On
 * the deploy host that is the difference between a five-minute fix and a broken
 * deploy.
 *
 * `server-only` because several of these names are secrets, and because the
 * inlining rules differ between the server and the client bundle.
 */
import "server-only";

/**
 * A required variable is missing or unusable.
 *
 * A distinct type so callers can tell "this deployment is misconfigured" apart
 * from "the payment provider is briefly unreachable". The first is an operator
 * problem worth naming in the response; the second must not leak internals to a
 * customer, and retrying is the right response.
 */
export class MissingEnvError extends Error {
  readonly variables: string[];

  constructor(variables: string[]) {
    super(
      `Missing required environment ${variables.length === 1 ? "variable" : "variables"}: ` +
        `${variables.join(", ")}. Set ${variables.length === 1 ? "it" : "them"} in .env.local ` +
        `for local work, and in the project's Environment Variables on the host.`,
    );
    this.name = "MissingEnvError";
    this.variables = variables;
  }
}

/**
 * Returns the value of `name`, or throws naming exactly what is missing and where
 * to set it.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) throw new MissingEnvError([name]);

  return value;
}

/**
 * Checks a set of variables up front and reports all of them at once.
 *
 * Prefer this at the top of a request handler: validating variables one at a time
 * means discovering them one failed deploy at a time.
 */
export function requireEnvAll(names: string[]): void {
  const missing = names.filter((name) => !process.env[name]);

  if (missing.length > 0) throw new MissingEnvError(missing);
}

/** The two Supabase values every client factory needs. */
export function requireSupabasePublicEnv(): { url: string; publishableKey: string } {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}
