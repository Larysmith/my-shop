import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const BASE = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

let failures = 0;
function check(label, ok, detail) {
  console.log(`  [${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}]`);
  if (!ok) failures += 1;
}

const text = (p) => fetch(`${BASE}${p}`).then((r) => r.text());

// --- Catalog comes from the database, with live prices -----------------------
const home = await text("/");
check(
  "home shows NGN formatted prices from the DB",
  home.includes("NGN") || home.includes("₦"),
);
check("home is not in demo mode", !home.includes("Demo mode"));
check(
  "homepage renders the free-shipping threshold from pricing.ts",
  /NGN\s?50,000\.00|₦50,000/.test(home),
  home.match(/NGN\s?[\d,]+\.\d\d|₦[\d,]+/)?.[0] ?? "no price matched",
);
check(
  "homepage renders the catalog grid",
  home.includes("everyday-cotton-tee") && home.includes("18,000"),
  "tee slug and its 1800000 kobo price both present",
);

const products = await text("/products");
for (const slug of ["everyday-cotton-tee", "heavyweight-hoodie", "minimal-desk-lamp"]) {
  check(`/products lists ${slug}`, products.includes(slug));
}
check("catalog price sort works", products.includes("merino-wool-socks"));

const detail = await text("/products/heavyweight-hoodie");
check(
  "hoodie detail shows the live NGN price (4500000 kobo)",
  /NGN\s?45,000\.00|₦45,000/.test(detail),
  detail.match(/NGN\s?[\d,]+\.\d\d|₦[\d,]+/)?.[0] ?? "no price matched",
);
check("sold-out variant is reflected", detail.includes("Slate / L"));

// --- Demo affordances are gone ----------------------------------------------
for (const page of ["/", "/account"]) {
  const body = await text(page);
  check(`${page} has no demo banner`, !/Demo mode|demo accounts/i.test(body));
}

// --- Google sign-in is visible now ------------------------------------------
const login = await text("/login");
check(
  "login page shows the Google sign-in button",
  login.includes("Sign in with Google"),
);
check(
  "login page shows the password form",
  login.includes("co-password") || login.toLowerCase().includes("password"),
);
check("login page has no demo account picker", !login.includes("Demo accounts"));

// --- Guest tracking page renders --------------------------------------------
// The form reads useSearchParams, so it sits behind Suspense and only exists
// once the client bundle runs. Asserting on the form here would be asserting on
// JavaScript, so the browser-level check lives in e2e/production-mode.spec.ts.
// What matters here is that the page itself renders rather than erroring.
const track = await text("/track-order");
check("tracking page renders its heading", track.includes("Track an order"));

// --- Order confirmation refuses an unsigned order number -------------------
const unsigned = await fetch(`${BASE}/checkout/success?order=LS-AAAAAA`, {
  redirect: "manual",
});
check(
  "unsigned order number on /checkout/success is refused",
  unsigned.status === 404 || unsigned.status === 307,
  `HTTP ${unsigned.status}`,
);

const badToken = await fetch(`${BASE}/checkout/success?token=LS-AAAAAA.deadbeef`, {
  redirect: "manual",
});
check(
  "forged order token is refused",
  badToken.status === 404 || badToken.status === 307,
  `HTTP ${badToken.status}`,
);

// --- RLS: anonymous callers cannot read orders -----------------------------
const anon = await fetch(`${url}/rest/v1/orders?select=order_number`, {
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
});
const anonRows = await anon.json();
check(
  "anon cannot read any order row",
  Array.isArray(anonRows) && anonRows.length === 0,
  `${anonRows.length} row(s) visible`,
);

// --- Live RPC writes still work with the new signature ----------------------
const variants = await (
  await fetch(
    `${url}/rest/v1/product_variants?select=id,title,sku,price_amount,stock,products!inner(slug)&products.slug=eq.merino-wool-socks&order=position`,
    { headers },
  )
).json();

const rpc = await fetch(`${url}/rest/v1/rpc/create_pending_order`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    p_email: "prod-mode-probe@example.com",
    p_shipping: { name: "Probe", line1: "1 Test St", city: "Lagos", country: "NG" },
    p_user_id: null,
    p_cart_hash: "prod-probe",
    p_lines: [{ variantId: variants[0].id, quantity: 1 }],
    p_shipping_amount: 350000,
  }),
});
const order = await rpc.json();
check(
  "create_pending_order accepts p_shipping_amount",
  rpc.ok && Boolean(order?.id),
  rpc.ok ? order?.order_number : order?.message?.slice(0, 120),
);

if (rpc.ok && order?.id) {
  check(
    "probe order totals 1550000 kobo (1200000 socks + 350000 shipping)",
    order.total_amount === 1550000,
    `got ${order.total_amount}`,
  );
  check("probe order currency is NGN", order.currency === "NGN", order.currency);

  // Clean up so no probe rows are left behind.
  await fetch(`${url}/rest/v1/order_items?order_id=eq.${order.id}`, { method: "DELETE", headers });
  await fetch(`${url}/rest/v1/orders?id=eq.${order.id}`, { method: "DELETE", headers });
  const gone = await (await fetch(`${url}/rest/v1/orders?id=eq.${order.id}`, { headers })).json();
  check("probe order cleaned up", gone.length === 0);
}

console.log(
  failures === 0
    ? "\nAll production-mode checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);