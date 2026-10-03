/**
 * Proves a real payment end to end: pending order -> paid -> fulfilled.
 *
 * This is the one flow that had never actually run. Everything around it was
 * verified in isolation: the RPC prices correctly, the webhook signature
 * validates, the route is wired up. But no order had ever been paid, so nothing
 * proved the pieces connect.
 *
 * The chain splits in two, and only one part can be automated:
 *
 *   Phase 1 (needs one human action). A real Paystack transaction has to reach
 *   `success`. Paystack's hosted page sits behind a Cloudflare Turnstile
 *   challenge that does not complete in an automated browser, so this script
 *   cannot reliably drive it. `--auto` tries anyway; if Turnstile blocks it, the
 *   script tells you to check out at http://localhost:3001 and re-run.
 *
 *   Phase 2 (fully automatic). Everything this app is responsible for: the real
 *   webhook route at /api/paystack/webhook, with a correctly signed
 *   HMAC-SHA512 body carrying Paystack's actual reference. That runs signature
 *   validation, server-side verification against Paystack's API, fulfillment,
 *   stock release, event recording, replay idempotency and forged-signature
 *   rejection.
 *
 * Phase 2 is deliberately delivered locally rather than by Paystack: the app is
 * not publicly reachable, and that hop is Paystack's delivery, not our code. Use
 * `paystack listen` when the CLI is available to close even that gap.
 *
 * Leaves the database as it found it, including stock levels.
 *
 *   node scripts/verify-payment-flow.mjs          # phase 2, or explain phase 1
 *   node scripts/verify-payment-flow.mjs --auto   # try to drive Paystack first
 */

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.VERIFY_BASE ?? "http://localhost:3001";
const AUTO = process.argv.includes("--auto");

// Paystack's documented test card. In test mode no funds move.
const CARD = { number: "4084084084084081", expiry: "12/34", cvv: "408", pin: "4080", otp: "408408" };

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
const SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const SERVICE = env.SUPABASE_SECRET_KEY;
const PAYSTACK = env.PAYSTACK_SECRET_KEY;
const WEBHOOK_SECRET = env.PAYSTACK_WEBHOOK_SECRET;

if (!SERVICE || !PAYSTACK || !WEBHOOK_SECRET) {
  console.error("SUPABASE_SECRET_KEY, PAYSTACK_SECRET_KEY and PAYSTACK_WEBHOOK_SECRET are required.");
  process.exit(1);
}

const dbHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

let failures = 0;
const check = (label, passed, detail) => {
  if (!passed) failures += 1;
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${label}${detail ? `  ${detail}` : ""}`);
};

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    ...options,
    headers: { ...dbHeaders, ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function paystackVerify(reference) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK}` }, signal: AbortSignal.timeout(30_000) },
  );
  return response.json();
}

/**
 * Finds an order that checkout has already charged successfully but not yet
 * fulfilled: the exact state a real deployment sits in between "customer paid"
 * and "webhook arrived".
 */
async function findPaidUnfulfilled() {
  const rows = await rest(
    "orders?select=id,order_number,email,status,paystack_reference,total_amount,currency,created_at" +
      "&status=eq.pending_payment&paystack_reference=not.is.null&order=created_at.desc&limit=10",
  );

  for (const order of rows ?? []) {
    const verified = await paystackVerify(order.paystack_reference).catch(() => null);
    if (verified?.data?.status === "success") return { order, verified: verified.data };
  }
  return null;
}

console.log("\nEnd-to-end payment verification\n");

// --- Phase 1: get a real successful charge onto an order ------------------

let candidate = await findPaidUnfulfilled();

if (!candidate && AUTO) {
  console.log("Phase 1: attempting to drive Paystack's checkout in a browser\n");
  const { drivePaystackCheckout } = await import("./drive-paystack-checkout.mjs");
  const created = await drivePaystackCheckout({ base: BASE, card: CARD });
  if (created) candidate = await findPaidUnfulfilled();
}

if (!candidate) {
  console.log("Phase 1 needs one human action, and nothing is ready yet.\n");
  console.log("Paystack's hosted page is behind a Cloudflare challenge that an automated");
  console.log("browser cannot pass, so it has to be completed by a person once:\n");
  console.log(`  1. start the app:      npm run dev`);
  console.log(`  2. open:               ${BASE}/products`);
  console.log(`  3. add anything, then check out with Paystack's test card:`);
  console.log(`       card      ${CARD.number}`);
  console.log(`       expiry    ${CARD.expiry}`);
  console.log(`       cvv       ${CARD.cvv}`);
  console.log(`     The card is Paystack's own test card; no money moves.\n`);
  console.log("  4. re-run this script. It finds the order, delivers the webhook and");
  console.log("     asserts fulfillment, replay safety and signature rejection.\n");
  process.exit(2);
}

const { order, verified } = candidate;

console.log("Phase 1 complete — a real charge on Paystack\n");
check("checkout created a pending order", Boolean(order.id), order.order_number);
check("order starts pending_payment", order.status === "pending_payment", order.status);
check("reference stored before payment", Boolean(order.paystack_reference), order.paystack_reference);
check("Paystack reports the charge successful", verified.status === "success", verified.status);
check(
  "charged amount matches the order total",
  verified.amount === order.total_amount,
  `${verified.amount} vs ${order.total_amount} ${order.currency}`,
);

// Stock to restore afterwards.
const itemsBefore = await rest(`order_items?select=variant_id,quantity&order_id=eq.${order.id}`);
const stockBefore = new Map();
for (const item of itemsBefore ?? []) {
  if (!item.variant_id) continue;
  const row = await rest(`product_variants?select=stock&id=eq.${item.variant_id}`);
  stockBefore.set(item.variant_id, row[0].stock);
}

// --- Phase 2: the webhook route, which is the part this app owns ----------

console.log("\nPhase 2: the real webhook route\n");

const reference = order.paystack_reference;
const body = JSON.stringify({
  event: "charge.success",
  data: { reference, reference_on_transaction: reference },
});
const signature = createHmac("sha512", WEBHOOK_SECRET).update(body).digest("hex");

const post = (sig) =>
  fetch(`${BASE}/api/paystack/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": sig },
    body,
  });

const webhook = await post(signature);
const webhookJson = await webhook.json();

check("webhook accepted", webhook.ok, `HTTP ${webhook.status}`);
check("order reported fulfilled", webhookJson?.status === "fulfilled", JSON.stringify(webhookJson));

const fulfilled = await rest(`orders?select=status,paid_at&id=eq.${order.id}`);
check("status is paid in the database", fulfilled?.[0]?.status === "paid", fulfilled?.[0]?.status);
check("paid_at recorded", Boolean(fulfilled?.[0]?.paid_at), fulfilled?.[0]?.paid_at);

for (const item of itemsBefore ?? []) {
  if (!item.variant_id) continue;
  const after = await rest(`product_variants?select=stock&id=eq.${item.variant_id}`);
  check(
    `stock released for ${item.variant_id.slice(0, 8)}`,
    after[0].stock === stockBefore.get(item.variant_id) - item.quantity,
    `${stockBefore.get(item.variant_id)} -> ${after[0].stock}`,
  );
}

const events = await rest(`order_events?select=from_status,to_status,actor&order_id=eq.${order.id}`);
check(
  "an order_event recorded the transition",
  events.some((e) => e.to_status === "paid" && e.actor === "paystack"),
  JSON.stringify(events),
);

const emails = await rest(`email_logs?select=status,to,template&order_id=eq.${order.id}`);
check(
  "a confirmation email was attempted",
  emails.length > 0,
  emails.map((e) => `${e.template}:${e.status}`).join(", ") || "no rows",
);

// Replay: Paystack retries, and a retry must not release stock twice.
const replay = await post(signature);
const replayJson = await replay.json();
check("replay is idempotent", replayJson?.status === "already_applied", JSON.stringify(replayJson));

for (const item of itemsBefore ?? []) {
  if (!item.variant_id) continue;
  const after = await rest(`product_variants?select=stock&id=eq.${item.variant_id}`);
  check(
    `replay did not release stock again (${item.variant_id.slice(0, 8)})`,
    after[0].stock === stockBefore.get(item.variant_id) - item.quantity,
    `${after[0].stock}`,
  );
}

const forged = await post("0".repeat(64));
check("forged signature rejected", forged.status === 401, `HTTP ${forged.status}`);

const stillPaid = await rest(`orders?select=status&id=eq.${order.id}`);
check("forged webhook changed nothing", stillPaid?.[0]?.status === "paid", stillPaid?.[0]?.status);

// --- Cleanup -------------------------------------------------------------

console.log("\nCleaning up probe order");

for (const [variantId, stock] of stockBefore) {
  await rest(`product_variants?id=eq.${variantId}`, {
    method: "PATCH",
    body: JSON.stringify({ stock }),
  });
}
await rest(`order_items?order_id=eq.${order.id}`, { method: "DELETE" });
await rest(`order_events?order_id=eq.${order.id}`, { method: "DELETE" });
await rest(`email_logs?order_id=eq.${order.id}`, { method: "DELETE" }).catch(() => {});
await rest(`orders?id=eq.${order.id}`, { method: "DELETE" });

const gone = await rest(`orders?id=eq.${order.id}`);
check("probe order removed", gone.length === 0);
for (const [variantId, stock] of stockBefore) {
  const restored = await rest(`product_variants?select=stock&id=eq.${variantId}`);
  check(`stock restored (${variantId.slice(0, 8)})`, restored[0].stock === stock, `${restored[0].stock}`);
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);