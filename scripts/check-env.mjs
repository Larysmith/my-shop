/**
 * Reports which environment variables the app needs, and which are set locally.
 *
 * Exists because the set is split across three concerns and it is easy to miss
 * one until a deploy is live: Supabase, Paystack, and email. A missing value is a
 * runtime failure in the middle of a customer's checkout, not a build error, so
 * it is worth knowing before that happens.
 *
 * Read-only. Never prints a value, only whether one is set.
 *
 *   node scripts/check-env.mjs
 *   node scripts/check-env.mjs --names-only   # the list to paste into Netlify
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function isPlaceholder(value) {
  return !value || /[<>]/.test(value);
}

/**
 * Every variable the app reads, grouped by what breaks without it.
 *
 * `exposed: true` means it must also be set as a NEXT_PUBLIC_* variable on Netlify,
 * because those are inlined into the client bundle at build time — a server-only
 * copy does not reach the browser.
 */
const REQUIRED = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", exposed: true, group: "Supabase", why: "project URL for every read" },
  { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", exposed: true, group: "Supabase", why: "anon key, RLS applies" },
  { name: "SUPABASE_SECRET_KEY", exposed: false, group: "Supabase", why: "admin reads, order fulfillment" },
  { name: "NEXT_PUBLIC_SITE_URL", exposed: true, group: "Paystack", why: "absolute callback URL for checkout" },
  { name: "PAYSTACK_SECRET_KEY", exposed: false, group: "Paystack", why: "initialise and verify transactions" },
  { name: "PAYSTACK_WEBHOOK_SECRET", exposed: false, group: "Paystack", why: "HMAC signature verification" },
  { name: "EMAIL_PROVIDER", exposed: false, group: "Email", why: "brevo, mailgun, or none" },
  { name: "MAILGUN_API_KEY", exposed: false, group: "Email", why: "required when EMAIL_PROVIDER=mailgun" },
  { name: "MAILGUN_DOMAIN", exposed: false, group: "Email", why: "sending domain" },
  { name: "MAILGUN_FROM_EMAIL", exposed: false, group: "Email", why: "must be on the verified sending domain" },
  { name: "NEXT_PUBLIC_DEMO_MODE", exposed: true, group: "Modes", why: "false in production" },
  { name: "MERCHANT_NOTIFICATION_EMAIL", exposed: false, group: "Email", why: "where fulfilment alerts go" },
];

if (process.argv.includes("--names-only")) {
  console.log(REQUIRED.map((entry) => entry.name).join("\n"));
  process.exit(0);
}

let local = {};
try {
  local = parseEnv(await readFile(join(ROOT, ".env.local"), "utf8"));
} catch {
  console.error("No .env.local found. Set the variables below in your environment.\n");
}

const groups = new Map();
for (const entry of REQUIRED) {
  if (!groups.has(entry.group)) groups.set(entry.group, []);
  groups.get(entry.group).push(entry);
}

let missing = 0;

for (const [group, entries] of groups) {
  console.log(`\n${group}`);

  for (const entry of entries) {
    const value = local[entry.name];
    const set = !isPlaceholder(value);
    if (!set) missing += 1;

    const exposure = entry.exposed ? "client-exposed" : "server only ";
    console.log(`  ${set ? "set    " : "MISSING"}  ${entry.name.padEnd(38)} ${exposure}  ${entry.why}`);
  }
}

console.log(
  "\nSet the client-exposed ones as NEXT_PUBLIC_* on Netlify too: they are inlined into\n" +
    "browser bundle at build time, so a server-only copy never reaches the client.",
);

if (missing > 0) {
  console.log(`\n${missing} variable(s) unset in .env.local.`);
  process.exit(1);
}

console.log("\nAll required variables are set.");
