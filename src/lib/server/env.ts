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

export { requireSupabasePublicEnv } from "@/lib/supabase/env";

export function requireSupabaseSecretEnv(): string {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    throw new Error(
      "Missing required environment variable SUPABASE_SECRET_KEY or " +
        "SUPABASE_SERVICE_ROLE_KEY. Set it in Netlify environment variables " +
        "for Functions, or in .env.local for local work. Never prefix it with NEXT_PUBLIC_.",
    );
  }

  return secretKey;
}
