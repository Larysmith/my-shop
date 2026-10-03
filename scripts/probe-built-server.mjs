/**
 * Boots the built app with .env.local hidden and the server log captured, so a
 * failing page can be diagnosed from the real error instead of guessed at.
 *
 *   node scripts/probe-built-server.mjs [port]
 */

import { spawn } from "node:child_process";
import { readFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] ?? 3007);
const ENV_FILE = join(ROOT, ".env.local");
const HIDDEN = join(ROOT, ".env.local.probe-hidden");

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

const env = parseEnv(await readFile(ENV_FILE, "utf8"));
await rename(ENV_FILE, HIDDEN);

const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
  env: { ...process.env, ...env, PORT: String(PORT) },
});

let log = "";
server.stdout.on("data", (c) => (log += c));
server.stderr.on("data", (c) => (log += c));

try {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://localhost:${PORT}/`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  for (const path of ["/", "/products", "/checkout"]) {
    const response = await fetch(`http://localhost:${PORT}${path}`);
    console.log(`${String(response.status).padEnd(4)} ${path}`);
  }

  console.log(`\n--- server log ---\n${log.split(/\r?\n/).slice(-40).join("\n")}`);
} finally {
  server.kill();
  await rename(HIDDEN, ENV_FILE);
}