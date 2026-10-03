/**
 * Deletes pending orders left behind by probe and checkout experiments.
 *
 * A pending order with a Paystack reference that was never paid is not an error
 * — that is the normal state of an abandoned checkout — but the probes create
 * several, and they clutter the admin order list.
 *
 * Only touches rows whose email looks like a probe, and never touches a paid or
 * shipped order.
 *
 *   node scripts/cleanup-probe-orders.mjs [--all-pending]
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALL_PENDING = process.argv.includes("--all-pending");

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
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const rest = async (path, options = {}) => {
  const response = await fetch(`${BASE}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

const rows =
  (await rest("orders?select=id,order_number,email,status&status=eq.pending_payment&order=created_at.desc&limit=100")) ?? [];

const targets = ALL_PENDING
  ? rows
  : rows.filter((order) => /probe|inspect|example\.com$/i.test(order.email ?? ""));

console.log(`\npending orders: ${rows.length}, to remove: ${targets.length}\n`);

for (const order of targets) {
  await rest(`order_items?order_id=eq.${order.id}`, { method: "DELETE" });
  await rest(`order_events?order_id=eq.${order.id}`, { method: "DELETE" });
  await rest(`email_logs?order_id=eq.${order.id}`, { method: "DELETE" }).catch(() => {});
  await rest(`orders?id=eq.${order.id}`, { method: "DELETE" });
  console.log(`  removed ${order.order_number}  ${order.email}`);
}

const remaining = await rest("orders?select=id&status=eq.pending_payment");
console.log(`\npending remaining: ${remaining?.length ?? 0}\n`);