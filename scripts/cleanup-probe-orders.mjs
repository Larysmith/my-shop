import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function del(path, label) {
  const r = await fetch(`${url}${path}`, { method: "DELETE", headers });
  console.log(`${label}: HTTP ${r.status}`);
  return r.ok;
}

// Stray rows from probes whose cleanup was interrupted by a network fault.
const orders = await (
  await fetch(`${url}/rest/v1/orders?select=id,order_number,email,status&email=eq.rpc-probe@example.com`, { headers })
).json();

console.log(`probe orders found: ${orders.length}`);
for (const o of orders) {
  console.log(`  ${o.order_number} status=${o.status}`);
  await del(`/rest/v1/order_items?order_id=eq.${o.id}`, `  items for ${o.order_number}`);
  await del(`/rest/v1/order_events?order_id=eq.${o.id}`, `  events for ${o.order_number}`);
  await del(`/rest/v1/orders?id=eq.${o.id}`, `  order ${o.order_number}`);
}

const after = await (
  await fetch(`${url}/rest/v1/orders?select=id&email=eq.rpc-probe@example.com`, { headers })
).json();
console.log(`probe orders remaining: ${after.length}`);