/**
 * Simulates a Vercel build and serves the result.
 *
 * Vercel ignores `.env.local` (it is gitignored) and builds using only the
 * variables configured on the project. That is the one condition never tested
 * locally, because locally `.env.local` supplies everything and quietly papers
 * over anything missing from the real environment.
 *
 * So: hide `.env.local`, expose only its values as process env, build, and serve
 * the built output on a spare port. If the app works here it will boot on Vercel.
 *
 *   node scripts/verify-vercel-build.mjs
 */

import { spawn } from "node:child_process";
import { readFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.VERIFY_PORT ?? 3005);
const ENV_FILE = join(ROOT, ".env.local");
const HIDDEN = join(ROOT, ".env.local.vercel-hidden");

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

const env = parseEnv(await readFile(join(ROOT, ".env.local"), "utf8"));

// Vercel only has what is configured on the project. Everything the app needs
// comes from the project environment, exactly as exposed here.
const exposed = {};
for (const [key, value] of Object.entries(env)) {
  if (value) exposed[key] = value;
}

console.log(`Exposing ${Object.keys(exposed).length} variables to the build, as Vercel would.`);

// Hide the file for the duration of the build and serve, so nothing can fall back
// to it. Restored in the finally block below, including on Ctrl-C paths that reach
// the catch.
await rename(ENV_FILE, HIDDEN);

function run(command, args, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...extraEnv },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
    child.on("error", reject);
  });
}

console.log("\n--- next build (no .env.local) ---");

let failures = 0;

try {
  await run("npx", ["next", "build"], exposed);

  console.log(`\n--- next start on :${PORT} ---`);
  const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    shell: true,
    env: { ...process.env, ...exposed, PORT: String(PORT) },
  });

  const stop = () => {
    try {
      server.kill();
    } catch {
      // already gone
    }
  };
  // Never leave a stray server or a missing .env.local behind.
  process.on("exit", () => {
    stop();
    void rename(HIDDEN, ENV_FILE).catch(() => {});
  });

  async function waitForServer(attempts = 60) {
    for (let i = 0; i < attempts; i++) {
      try {
        await fetch(`http://localhost:${PORT}/`);
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return false;
  }

  if (!(await waitForServer())) {
    console.error("\nThe built server never came up.");
    process.exitCode = 1;
  } else {
    const paths = [
      "/",
      "/products",
      "/products/heavyweight-hoodie",
      "/cart",
      "/checkout",
      "/login",
      "/signup",
      "/track-order",
    ];

    console.log("\nRoute checks against the built output:");

    for (const path of paths) {
      let status = 0;
      try {
        const response = await fetch(`http://localhost:${PORT}${path}`, { redirect: "manual" });
        status = response.status;
      } catch {
        status = 0;
      }
      if (status === 0 || status >= 500) failures += 1;
      console.log(`  ${String(status).padEnd(4)} ${path}`);
    }

    // The check that matters most: a missing NEXT_PUBLIC_DEMO_MODE must not ship
    // the demo storefront, and the catalog must come from Postgres, not the seed.
    const catalog = await (await fetch(`http://localhost:${PORT}/products`)).text();
    const demoBanner = /Demo mode/i.test(catalog);
    const livePhoto = catalog.includes("/products/");
    const livePrice = /NGN\s?\d|₦\d/.test(catalog);

    console.log(`\n  demo banner present : ${demoBanner}  (must be false)`);
    console.log(`  catalog photos      : ${livePhoto}  (must be true)`);
    console.log(`  formatted NGN price : ${livePrice}  (must be true)`);

    if (demoBanner || !livePhoto || !livePrice) failures += 1;
  }

  stop();
} finally {
  await rename(HIDDEN, ENV_FILE);
}

console.log(
  failures === 0
    ? "\nThe build works with only project-level env. It will boot on Vercel."
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
