/**
 * Environment variable reads that fail loudly and specifically.
 *
 * A bare `process.env.FOO!` turns a missing variable into a confusing crash three
 * frames away — either a Supabase assertion deep in the client library, or a
 * `fetch` to `undefined` that only fails on the first request in production. On
 * Vercel that is the difference between a five-minute fix and a broken deploy.
 *
 * `server-only` because several of these names are secrets, and because the
 * inlining rules differ between the server and the client bundle.
 */
import "server-only";

/**
 * Returns the value of `name`, or throws naming exactly what is missing and where
 * to set it.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env.local for local work, and in the project's Environment ` +
        `Variables on Vercel. See .env.example for the full list.`,
    );
  }

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

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment ${missing.length === 1 ? "variable" : "variables"}: ` +
        `${missing.join(", ")}. Set them in .env.local for local work, and in the ` +
        `project's Environment Variables on Vercel.`,
    );
  }
}

/** The two Supabase values every client factory needs. */
export function requireSupabasePublicEnv(): { url: string; publishableKey: string } {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}
