/**
 * Simulates a deploy-host build and serves the result.
 *
 * The deploy host ignores `.env.local` (it is gitignored) and builds using only
 * the variables configured on the site. That is the one condition never tested
 * locally, because locally `.env.local` supplies everything and quietly papers
 * over anything missing from the real environment.
 *
 * So: hide `.env.local`, expose only its values as process env, build, and serve
 * the built output on a spare port. If the app works here it will boot on Netlify.
 *
 *   node scripts/verify-deploy-build.mjs
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.VERIFY_PORT ?? 3005);
const ENV_FILE = join(ROOT, ".env.local");
const HIDDEN = join(ROOT, ".env.local.deploy-hidden");

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

// The deploy host only has what is configured on the site. Everything the app
// needs comes from that environment, exactly as exposed here.
//
// --no-env builds with nothing at all, which reproduces the most common
// misconfiguration: the repo was connected but the variables were never added.
const noEnv = process.argv.includes("--no-env");
const exposed = {};

if (!noEnv) {
  for (const [key, value] of Object.entries(env)) {
    if (value) exposed[key] = value;
  }
}

console.log(
  noEnv
    ? "Building with NO environment variables, to reproduce an unconfigured project."
    : `Exposing ${Object.keys(exposed).length} variables to the build, as the deploy host would.`,
);

// Hide the file for the duration of the build and serve, so nothing can fall back
// to it. Restored in the finally block below, including on Ctrl-C paths that reach
// the catch.
await rename(ENV_FILE, HIDDEN);

// Next loads .env.local in `next start` as well as `next build`, so the rename has
// to still be in effect when the server boots, not just when it compiles.
console.log(`  .env.local hidden before build: ${!existsSync(ENV_FILE)}`);
console.log(`  values exposed to the build   : ${Object.keys(exposed).length}`);

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
      let body = "";
      try {
        const response = await fetch(`http://localhost:${PORT}${path}`, { redirect: "manual" });
        status = response.status;
        body = await response.text();
      } catch {
        status = 0;
      }

      // A page that throws still returns 200 when an error.tsx boundary catches
      // it, so status alone proves nothing — check the body too. This is not
      // theoretical: an unconfigured deploy once passed here on status alone,
      // which is how the missing-env 500 got deployed in the first place.
      const threw =
        /Missing required environment/i.test(body) ||
        /Supabase is not configured/i.test(body) ||
        /URL and Key are required/i.test(body) ||
        /Application error|Internal Server Error/i.test(body);

      if (status === 0 || status >= 500 || threw) failures += 1;
      console.log(
        `  ${String(status).padEnd(4)} ${path}${threw ? "   <- rendered an error" : ""}`,
      );
    }

    // The check that matters most: a missing NEXT_PUBLIC_DEMO_MODE must not ship
    // the demo storefront, and the catalog must come from Postgres, not the seed.
    const catalog = await (await fetch(`http://localhost:${PORT}/products`)).text();
    const demoBanner = /Demo mode/i.test(catalog);

    // A page that throws still returns 200 when an error.tsx boundary catches it,
    // so status alone proves nothing. Look for our own diagnostics in the body.
    const missingEnv = catalog.match(/Missing required environment variables?:[^<"]{0,200}/)?.[0];
    const appError = /Application error|Internal Server Error/i.test(catalog);

    // Real product rows: a price rendered for an actual product name, not the
    // static "Free shipping over ..." line in the page header.
    const livePhoto = /\/products\/[a-z0-9-]+\.jpg/.test(catalog);
    const livePrice = /NGN\s?\d|₦\d/.test(catalog);

    console.log(`\n  demo banner present : ${demoBanner}  (must be false)`);
    console.log(`  missing-env error  : ${missingEnv ?? "none"}`);
    console.log(`  app error page     : ${appError}  (must be false)`);
    console.log(`  catalog photos     : ${livePhoto}  (must be true)`);
    console.log(`  formatted NGN price: ${livePrice}  (must be true)`);

    if (demoBanner || missingEnv || appError || !livePhoto || !livePrice) failures += 1;
  }

  stop();
} finally {
  await rename(HIDDEN, ENV_FILE);
}

console.log(
  failures === 0
    ? "\nThe build works with only site-level env. It will boot on Netlify."
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
