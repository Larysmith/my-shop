import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const SELECT =
  "id,title,sku,price_amount,stock,position,is_default,is_active,image_url," +
  "products!inner(id,name,slug,description,category,status,sort_order,image_url)";

const r = await fetch(`${url}/rest/v1/product_variants?select=${encodeURIComponent(SELECT)}&is_active=eq.true&order=position`, { headers });
const rows = await r.json();

console.log("HTTP", r.status, "rows", rows.length);
const first = rows[0];
console.log("variant keys:", Object.keys(first).join(", "));
console.log("product keys :", Object.keys(first.products ?? {}).join(", "));
console.log("sample product:", JSON.stringify({
  id: first.products?.id,
  name: first.products?.name,
  slug: first.products?.slug,
  category: first.products?.category,
  sort_order: first.products?.sort_order,
  image_url: first.products?.image_url,
  variant_image_url: first.image_url,
  is_default: first.is_default,
  position: first.position,
}, null, 1));

const products = new Set(rows.map((x) => x.products?.id));
console.log(`distinct products: ${products.size}`);
const imageCounts = rows.filter((x) => x.products?.image_url).length;
console.log(`products with image_url: ${imageCounts}/${rows.length} rows`);
const defaults = rows.filter((x) => x.is_default);
console.log(`variants flagged is_default: ${defaults.length} (expect 8)`);