import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Proves the RLS policies and the 0004 grants behave as designed. The whole
// point of 0004 is that anon can read the catalog but cannot reach the
// SECURITY DEFINER writers, so those are the cases asserted here.
//
// Keys are never printed. Only status codes and row counts.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;

if (!BASE || !ANON || !SECRET) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

let failures = 0;

// Postgres RLS has two valid "denied" shapes: a permission error, or a 200 that
// returns zero rows. Either is safe, so `leakFree` accepts both.
function allow(s) {
  return s >= 200 && s < 300;
}
function deny(s) {
  return s >= 400;
}
function leakFree(status, text, res) {
  if (status >= 400) return true;
  if (!res.ok) return true;
  const range = res.headers.get("content-range");
  if (range) return range.split("/")[1] === "0";
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.length === 0;
    return parsed === null;
  } catch {
    return false;
  }
}

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

// Only connection-level faults are retried. A timeout or reset can mean the
// request never reached PostgREST, which is safe to repeat. A 4xx/5xx means it
// did arrive and was answered, and these calls include mutating RPCs such as
// decrement_stock, so repeating those could apply an effect twice.
async function requestWithRetry(url, init) {
  let lastFault = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (caught) {
      lastFault = caught;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
      }
    }
  }

  throw new Error(
    `no response after ${MAX_ATTEMPTS} attempt(s): ${
      lastFault instanceof Error ? lastFault.message : String(lastFault)
    }`,
  );
}

async function call(label, { path, key, method = "GET", body, expect }) {
  let res;
  try {
    res = await requestWithRetry(`${BASE}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (caught) {
    failures += 1;
    console.log(`  [FAIL] ${label}`);
    console.log(`         no response — ${caught instanceof Error ? caught.message : String(caught)}`);
    return;
  }

  const text = await res.text();
  const detail = res.ok ? summarise(text, res) : text.slice(0, 120).replace(/\s+/g, " ");

  const passed = expect(res.status, text, res);
  if (!passed) failures += 1;

  console.log(`  [${passed ? "PASS" : "FAIL"}] ${label}`);
  console.log(`         HTTP ${res.status}${detail ? `  ${detail}` : ""}`);
}

function summarise(text, res) {
  const range = res.headers.get("content-range");
  if (range) return `rows=${range.split("/")[1] ?? "?"}`;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return `rows=${parsed.length}`;
    if (parsed === null) return "null";
    if (typeof parsed === "object") return `object`;
  } catch {
    /* not json */
  }
  return text.slice(0, 60).replace(/\s+/g, " ");
}

console.log("\n1. Catalog is publicly readable (anon, RLS active)\n");
await call("anon reads products", { path: "products?select=id", key: ANON, expect: allow });
await call("anon reads product_variants", { path: "product_variants?select=id", key: ANON, expect: allow });

console.log("\n2. Order data does not leak to anon\n");
await call("anon sees no orders", { path: "orders?select=id", key: ANON, expect: leakFree });
await call("anon sees no order_items", { path: "order_items?select=id", key: ANON, expect: leakFree });
await call("anon sees no profiles", { path: "profiles?select=id", key: ANON, expect: leakFree });
await call("anon sees no email_log", { path: "email_log?select=id", key: ANON, expect: leakFree });
await call("anon sees no order_events", { path: "order_events?select=id", key: ANON, expect: leakFree });

console.log("\n3. The SECURITY DEFINER writers are closed to anon\n");
await call("anon cannot create_pending_order", {
  path: "rpc/create_pending_order",
  key: ANON,
  method: "POST",
  body: {
    p_email: "attacker@example.com",
    p_shipping: { name: "X", line1: "1 St", city: "Y", country: "US" },
    p_user_id: null,
    p_cart_hash: "x",
    p_lines: [{ variantId: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
    p_shipping_cents: 0,
  },
  expect: deny,
});
await call("anon cannot decrement_stock", {
  path: "rpc/decrement_stock",
  key: ANON,
  method: "POST",
  body: { p_items: [{ variantId: "00000000-0000-0000-0000-000000000000", quantity: 1 }] },
  expect: deny,
});
await call("anon cannot insert an order row", {
  path: "orders",
  key: ANON,
  method: "POST",
  body: { order_number: "LS-HACK", email: "a@b.c" },
  expect: deny,
});

console.log("\n4. Guest lookup is intentionally public\n");
await call("anon can call lookup_guest_order", {
  path: "rpc/lookup_guest_order",
  key: ANON,
  method: "POST",
  body: { p_order_number: "LS-NOPE", p_email: "nobody@example.com" },
  expect: allow,
});

console.log("\n5. Service role still reaches the writers\n");
await call("secret key reads orders", { path: "orders?select=id", key: SECRET, expect: allow });
await call("secret key can call decrement_stock", {
  path: "rpc/decrement_stock",
  key: SECRET,
  method: "POST",
  body: { p_items: [] },
  expect: allow,
});

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) FAILED. Do not ship until these pass.\n`,
);
process.exit(failures === 0 ? 0 : 1);
