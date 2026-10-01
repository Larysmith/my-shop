import { readFileSync } from "node:fs";
import { Client } from "pg";

// Broad sweep over Supavisor regions and user formats.
// The password is never printed; only whether the connection succeeded.
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const password = env.SUPABASE_DB_PASSWORD;
const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
if (!password || !ref) {
  console.error("Missing SUPABASE_DB_PASSWORD or NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "sa-east-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1", "eu-south-1",
  "ap-southeast-1", "ap-southeast-2", "ap-southeast-3", "ap-southeast-4", "ap-southeast-5",
  "ap-southeast-7", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
  "ap-south-1", "ap-south-2", "me-central-1", "sa-east-2",
];

const users = [`postgres.${ref}`, "postgres"];
const seen = new Map();

for (const region of regions) {
  for (const user of users) {
    const client = new Client({
      host: `aws-0-${region}.pooler.supabase.com`,
      port: 5432,
      user,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000,
    });
    try {
      await client.connect();
      const { rows } = await client.query("select current_database() as db, current_user as u");
      await client.end();
      console.log(`OK  region=${region} user=${user} database=${rows[0].db} as=${rows[0].u}`);
      process.exit(0);
    } catch (err) {
      await client.end().catch(() => {});
      const msg = String(err.message).split("\n")[0].slice(0, 80);
      const key = msg.replace(region, "<region>");
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
}

console.log(`\nTried ${regions.length * users.length} combinations. Distinct errors:`);
for (const [msg, n] of seen) console.log(`  x${String(n).padStart(2)}  ${msg}`);
process.exit(1);
