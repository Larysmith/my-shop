/**
 * Paystack preflight.
 *
 * Validates the secret key and the webhook secret without creating a real
 * transaction. Safe to run any time: the only endpoints called are read-only
 * (balance, transaction list, a verify of a reference that does not exist).
 *
 * Why this exists: a wrong secret key fails only once a customer is already
 * standing on the checkout page, and a wrong webhook secret fails only once a
 * real payment has landed but cannot be fulfilled — the order stays
 * `pending_payment` and nothing ships. Both are worth catching beforehand.
 *
 * Real environment variables win over .env.local, so keys can be checked
 * without editing the file. PowerShell:
 *   $env:PAYSTACK_SECRET_KEY="sk_test_..."; npm run check:paystack
 */
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
// An override must not be ignored just because the shell value is empty.
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined && value !== "") env[key] = value;
}

const problems = [];
const notes = [];

function check(label, ok, detail) {
  console.log(`  [${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}]`);
  if (!ok) problems.push(label);
}

function note(label) {
  console.log(`  [NOTE  ${label}]`);
  notes.push(label);
}

const secretKey = env.PAYSTACK_SECRET_KEY;
const webhookSecret = env.PAYSTACK_WEBHOOK_SECRET;

console.log(`\nPAYSTACK_SECRET_KEY    = ${secretKey ? `set (${secretKey.length} chars)` : "<unset>"}`);
console.log(`PAYSTACK_WEBHOOK_SECRET = ${webhookSecret ? `set (${webhookSecret.length} chars)` : "<unset>"}\n`);

if (!secretKey) {
  console.error(
    "Missing PAYSTACK_SECRET_KEY. Paystack -> Settings -> API Keys & Integration.\n",
  );
  process.exit(1);
}

const isTestKey = secretKey.startsWith("sk_test_");
const isLiveKey = secretKey.startsWith("sk_live_");
check("secret key has a recognised prefix", isTestKey || isLiveKey, isLiveKey ? "LIVE KEY" : "test key");
if (isLiveKey) {
  note("this is a LIVE key — it can charge real cards. Confirm that is intended.");
}

async function call(path, init = {}) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body };
}

// --- Secret key ----------------------------------------------------------------

const balance = await call("/balance");
check(
  "secret key authenticates",
  balance.ok && balance.body?.status === true,
  balance.body?.message ?? `HTTP ${balance.status}`,
);

if (balance.body?.data) {
  // Paystack returns an array of per-currency balances. Keep the shape tolerant:
  // a single object has also been seen, and this is a diagnostic, not an assertion.
  const entries = Array.isArray(balance.body.data) ? balance.body.data : [balance.body.data];

  const ngn = entries.find((entry) => entry?.currency === "NGN");
  check(
    "account settles in NGN",
    Boolean(ngn),
    entries.map((entry) => entry?.currency).filter(Boolean).join(", ") || "no currency reported",
  );

  // Not printed in full: the balance response can carry an account identifier.
  if (ngn) {
    console.log(`  [OK    NGN balance: ${ngn.balance} kobo]`);
    if (Number(ngn.balance) === 0) {
      note(
        "the NGN balance is 0. That is expected on a fresh test account, but Paystack " +
          "will refuse to initialize a transaction with no funds, so a live checkout " +
          "needs a topped-up or settlement-enabled account.",
      );
    }
  }
}

// --- A reference that cannot exist --------------------------------------------
// Verifies the verify path end to end without creating anything. A 404 here is the
// correct outcome: it proves the endpoint, the auth, and the error shape all work.
const probe = await call(`/transaction/verify/${encodeURIComponent("probe-not-a-real-reference")}`);
check(
  "transaction/verify rejects an unknown reference",
  probe.status === 404 || probe.body?.status === false,
  `HTTP ${probe.status}: ${probe.body?.message ?? "no message"}`,
);

// --- Webhook secret ------------------------------------------------------------

if (!webhookSecret) {
  check("webhook secret is set", false, "Paystack -> Settings -> API Keys & Integration -> Webhooks");
} else if (/^whsec_/.test(webhookSecret)) {
  check("webhook secret is not a Stripe value", false, "it looks like a Stripe signing secret");
} else {
  check("webhook secret is set", true, `${webhookSecret.length} chars`);
  note(
    "the webhook secret cannot be verified from outside Paystack — it is only ever " +
      "compared against an incoming signature. A wrong value fails closed at runtime.",
  );
}

// --- Local forwarding ----------------------------------------------------------

const siteUrl = env.NEXT_PUBLIC_SITE_URL;
if (siteUrl && !/^https:\/\//.test(siteUrl)) {
  note(
    `NEXT_PUBLIC_SITE_URL is ${siteUrl}. Paystack cannot reach a non-public host, so ` +
      "webhooks will not arrive locally. Forward them with " +
      "`paystack listen --forward-to localhost:3001/api/paystack/webhook`",
  );
}

console.log("");
if (problems.length > 0) {
  console.log(`${problems.length} check(s) FAILED: ${problems.join(", ")}\n`);
  process.exit(1);
}
console.log("All checks passed.\n");
for (const n of notes) console.log(`  - ${n}`);
console.log("");