import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Applies supabase/migrations/*.sql in filename order through the Supabase
// Management API. This is the only DDL route available here: the direct DB host
// is IPv6-only and this machine has no IPv6 route, and the pooler does not
// resolve a tenant for this project.
//
// The access token is never printed.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_ID || env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is not set in .env.local");
  process.exit(1);
}
if (!ref) {
  console.error("Could not determine the project ref.");
  process.exit(1);
}

const dir = join(root, "supabase", "migrations");
const all = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// `npm run db:apply -- 0002_rls.sql` applies only the named files, so an
// already-applied migration never has to be re-run.
const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const files = requested.length
  ? all.filter((f) => requested.some((r) => f.includes(r)))
  : all;

if (files.length === 0) {
  console.error(requested.length ? "No migration matched those names." : "No migration files found.");
  console.error(`Available: ${all.join(", ")}`);
  process.exit(1);
}

console.log(`Project: ${ref}`);
console.log(`Applying ${files.length} migration(s):\n`);

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  process.stdout.write(`  ${file} ... `);

  let text = "";
  let ok = false;

  // The management API occasionally drops the TLS connection mid-request. The
  // migrations are written to be re-runnable, so retrying the whole file is
  // safe; giving up here would leave the schema half-applied.
  for (let attempt = 1; attempt <= 5 && !ok; attempt += 1) {
    if (attempt > 1) {
      const waitMs = attempt * 2000;
      process.stdout.write(`retry ${attempt} in ${waitMs / 1000}s ... `);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    let res;
    try {
      res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      text = `network: ${err.cause?.code ?? err.message}`;
      continue;
    }

    text = await res.text();
    ok = res.ok;

    // A 4xx is a real SQL or auth error. Retrying will not fix it.
    if (!ok && res.status >= 400 && res.status < 500) break;
  }

  if (!ok) {
    console.log("FAILED");
    console.error(`\n${file} did not apply. Server said:\n`);
    console.error(text.slice(0, 2000));
    console.error("\nStopped. No further migrations were attempted.");
    process.exit(1);
  }

  console.log("ok");
}

console.log("\nAll migrations applied.");
