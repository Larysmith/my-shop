/**
 * Reports pending orders and what Paystack says about each charge.
 *
 * The diagnostic for "the customer paid but nothing happened": a pending order
 * whose Paystack transaction is already `success` means the charge landed but
 * fulfillment never ran, which is a webhook delivery problem rather than a
 * payment problem. Distinguishing those two is the whole point.
 *
 *   node scripts/check-pending-payments.mjs
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
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = parseEnv(await readFile(join(ROOT, ".env.local"), "utf8"));
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const KEY = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK = env.PAYSTACK_SECRET_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const rest = async (path) => {
  const response = await fetch(`${BASE}/rest/v1/${path}`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

const rows =
  (await rest(
    "orders?select=id,order_number,email,status,total_amount,currency,paystack_reference,created_at" +
      "&status=eq.pending_payment&order=created_at.desc&limit=50",
  )) ?? [];

console.log(`\nPending orders: ${rows.length}\n`);

let stranded = 0;

for (const order of rows) {
  let remote = "(no reference)";
  if (order.paystack_reference) {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(order.paystack_reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK}` }, signal: AbortSignal.timeout(30_000) },
    ).catch(() => null);
    const json = response ? await response.json().catch(() => null) : null;
    remote = json?.data?.status ?? json?.message ?? "(lookup failed)";
  }

  if (remote === "success") stranded += 1;

  console.log(
    `  ${order.order_number}  ${String(order.total_amount).padStart(8)} ${order.currency}  ` +
      `${String(remote).padEnd(12)}  ${order.email}`,
  );
}

console.log(
  stranded === 0
    ? "\nNo paid-but-unfulfilled orders. Every pending order is genuinely unpaid.\n"
    : `\n${stranded} order(s) were PAID on Paystack but never fulfilled.\n` +
        `Run: node scripts/verify-payment-flow.mjs  to deliver the webhook and assert the rest.\n`,
);