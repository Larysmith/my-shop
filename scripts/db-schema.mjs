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

const env = parseEnv(await readFile(join(projectRoot, ".env.local"), "utf8"));
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const key = env.SUPABASE_SECRET_KEY;

if (!base || !key || /[<>]/.test(base) || /[<>]/.test(key)) {
  console.log("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const response = await fetch(`${base}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  signal: AbortSignal.timeout(20_000),
});

if (!response.ok) {
  console.log(`PostgREST root returned HTTP ${response.status}`);
  process.exit(1);
}

const spec = await response.json();
const definitions = spec.definitions ?? {};

const tables = Object.keys(definitions)
  .filter((name) => !name.startsWith("pg_"))
  .sort();

if (tables.length === 0) {
  console.log("No tables found in the public schema.");
  process.exit(0);
}

console.log("Found " + tables.length + " table(s) in the public schema:\n");

const counts = new Map();

for (const table of tables) {
  const columns = definitions[table].properties ?? {};
  const required = new Set(definitions[table].required ?? []);

  console.log(`${table}`);

  const rows = Object.entries(columns).map(([column, definition]) => {
    const type = definition.format
      ? `${definition.format}`
      : definition.type === "array"
        ? (definition.items?.format ?? definition.items?.type ?? "array")
        : definition.type;
    return { column, type, required: required.has(column) };
  });

  const width = Math.max(...rows.map((row) => row.column.length));
  for (const row of rows) {
    console.log(
      `  ${row.column.padEnd(width)}  ${String(row.type).padEnd(12)}${row.required ? "  NOT NULL" : ""}`,
    );
  }
  console.log("");
}

for (const table of tables) {
  try {
    const response = await fetch(`${base}/rest/v1/${table}?select=id`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
      signal: AbortSignal.timeout(20_000),
    });
    const contentRange = response.headers.get("content-range") ?? "";
    const total = contentRange.split("/")[1] ?? "?";
    counts.set(table, total);
  } catch {
    counts.set(table, "error");
  }
}

console.log("Row counts (counts only, no row data read):");
for (const [table, total] of counts) {
  console.log(`  ${table.padEnd(14)} ${total} row(s)`);
}

console.log("\nSchema and counts only. No column values were read.");
