import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { requireSupabasePublicEnv } from "../src/lib/supabase/env";
import { requireSupabaseSecretEnv } from "../src/lib/server/env";

const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
let original: Record<string, string | undefined>;

beforeEach(() => {
  original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
});

afterEach(() => {
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});

describe("Supabase environment configuration", () => {
  it("accepts anon and service-role variable names", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    assert.deepEqual(requireSupabasePublicEnv(), {
      url: "https://example.supabase.co",
      publishableKey: "test-anon",
    });
    assert.equal(requireSupabaseSecretEnv(), "test-service-role");
  });

  it("preserves publishable and secret key precedence", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    assert.equal(requireSupabasePublicEnv().publishableKey, "test-publishable");
    assert.equal(requireSupabaseSecretEnv(), "test-secret");
  });

  it("falls back when preferred variables are empty", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
    process.env.SUPABASE_SECRET_KEY = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    assert.equal(requireSupabasePublicEnv().publishableKey, "test-anon");
    assert.equal(requireSupabaseSecretEnv(), "test-service-role");
  });

  it("names missing public variables without falling back to an admin key", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    assert.throws(requireSupabasePublicEnv, /NEXT_PUBLIC_SUPABASE_URL/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.throws(requireSupabasePublicEnv, /PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("requires a separate server-only key for admin access", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
    assert.throws(requireSupabaseSecretEnv, /SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY/);
  });
});
