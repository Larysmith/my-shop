import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  if (!value) return true;
  return /[<>]/.test(value);
}

function mask(value) {
  if (!value) return "(empty)";
  return `${value.slice(0, 8)}…${value.slice(-4)} (${value.length} chars)`;
}

function describeKey(label, value) {
  if (!value) {
    console.log(`  ${label}: (empty)`);
    return;
  }
  const badChars = [...new Set(value.replace(/[A-Za-z0-9_-]/g, ""))];
  const problems = [];
  if (/\s/.test(value)) problems.push("contains whitespace");
  if (badChars.length > 0) {
    problems.push(
      `contains characters outside A-Z a-z 0-9 _ - : ${badChars.map((c) => JSON.stringify(c)).join(" ")}`,
    );
  }
  if (/^["']|["']$/.test(value)) problems.push("has a stray quote");
  console.log(`  ${label}: ${value.length} chars, ${problems.length === 0 ? "format OK" : problems.join("; ")}`);
}

async function probe(label, url, key) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.text()).slice(0, 200).replace(/\s+/g, " ");
    const ms = Date.now() - started;
    console.log(`  ${response.ok ? "OK  " : "FAIL"}  ${label} -> HTTP ${response.status} (${ms}ms)`);
    if (body) console.log(`        ${body}`);
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    const ms = Date.now() - started;
    console.log(`  FAIL  ${label} -> ${error.message} (${ms}ms)`);
    return { ok: false, status: 0, body: String(error.message) };
  }
}

const missing = [];
let env = {};

try {
  env = parseEnv(await readFile(join(projectRoot, ".env.local"), "utf8"));
} catch {
  console.log("Could not read .env.local at the project root.");
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = env.SUPABASE_SECRET_KEY;

for (const [name, value] of [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishable],
  ["SUPABASE_SECRET_KEY", secret],
]) {
  if (isPlaceholder(value)) missing.push(name);
}

console.log("\nKey format check (values never printed):");
describeKey("publishable key", publishable);
describeKey("secret key     ", secret);

console.log("\nConfigured values (masked, never printed in full):");
console.log(`  NEXT_PUBLIC_SUPABASE_URL          ${url || "(empty)"}`);
console.log(`  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ${mask(publishable)}`);
console.log(`  SUPABASE_SECRET_KEY               ${mask(secret)}`);

if (missing.length > 0) {
  console.log(`\nStill placeholders: ${missing.join(", ")}`);
  console.log("Open .env.local and paste the real values, then run this again.\n");
  process.exit(1);
}

if (url.includes("<")) {
  console.log("\nThe project URL still contains a placeholder.");
  process.exit(1);
}

const base = url.replace(/\/+$/, "");
console.log(`\nProbing ${base}`);

const health = await probe("auth health (publishable)", `${base}/auth/v1/health`, publishable);
await probe("PostgREST via publishable key", `${base}/rest/v1/products?select=id&limit=1`, publishable);
const privileged = await probe("PostgREST via secret key", `${base}/rest/v1/products?select=id&limit=1`, secret);

console.log("\nInterpretation:");
if (health.ok) {
  console.log("  - The project is reachable and the publishable key is valid.");
}
if (privileged.status === 404 || /does not exist/i.test(privileged.body)) {
  console.log("  - 'products' does not exist yet. Expected before the migration is applied.");
  console.log("  - It is an error, not empty data, which means RLS is being enforced.");
}
if (!privileged.ok && privileged.status !== 404) {
  console.log("  - The secret key did not authenticate. Check it was pasted without quotes or spaces.");
}

console.log("");
