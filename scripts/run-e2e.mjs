/**
 * Runs the E2E suite in both runtime modes.
 *
 * `NEXT_PUBLIC_DEMO_MODE` is inlined into the client bundle at compile time, so
 * the demo suite and the production suite cannot share one server — and Next
 * refuses to run two `next dev` processes against the same directory. The suite is
 * therefore run twice against the same server, restarted in the right mode between
 * runs, with an explicit spec file per mode so neither run can pick up the other's
 * tests.
 *
 * This wrapper exists because setting an env var per-invocation is not portable:
 * `FOO=bar cmd` is bash syntax and silently becomes a no-op under PowerShell or
 * cmd. Doing it in Node keeps `npm run test:e2e` working everywhere.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");

/**
 * Stops whatever is listening on the app port.
 *
 * A server left over from an earlier run would be reused as-is, and since the mode
 * is baked into the bundle, a stale server silently invalidates the whole run. So
 * the port is cleared instead of trusting `reuseExistingServer`.
 */
async function stopStaleDevServer() {
  if (process.platform !== "win32") {
    await new Promise((resolve) => {
      spawn("pkill", ["-f", "next dev"], { stdio: "ignore" }).on("exit", resolve);
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return;
  }

  const pids = await new Promise((resolve) => {
    const netstat = spawn("netstat", ["-ano", "-p", "TCP"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    netstat.stdout.on("data", (chunk) => (out += chunk));
    netstat.on("close", () => {
      const found = new Set();
      for (const line of out.split(/\r?\n/)) {
        // e.g. "TCP  0.0.0.0:3001  0.0.0.0:0  LISTENING  12345"
        const match = line.match(/:3001\s+\S+\s+LISTENING\s+(\d+)/);
        if (match) found.add(match[1]);
      }
      resolve(found);
    });
  });

  for (const pid of pids) {
    spawn("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
  }
  if (pids.size > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
}

function runPlaywright(spec, demoMode) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["playwright", "test", spec], {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: demoMode },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${spec} failed (exit ${code})`))));
    child.on("error", reject);
  });
}

const modes = [
  { spec: "e2e/demo-flow.spec.ts", demoMode: "true" },
  { spec: "e2e/production-mode.spec.ts", demoMode: "false" },
];

// A stale server started in the wrong mode would silently invalidate the run, so
// clear the port before the first run rather than relying on `reuseExistingServer`.
await stopStaleDevServer();

const failures = [];
for (const { spec, demoMode } of modes) {
  const label = demoMode === "true" ? "demo mode" : "production mode";
  console.log(`\n=== E2E (${label}) ===`);

  if (!existsSync(path.join(root, spec))) {
    console.log(`skipping missing spec ${spec}`);
    continue;
  }

  try {
    await runPlaywright(spec, demoMode);
  } catch (error) {
    failures.push(`${spec}: ${error.message}`);
  }

  // The next run needs a fresh bundle in the other mode.
  await stopStaleDevServer();
}

if (failures.length > 0) {
  console.error(`\nE2E failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

console.log("\nE2E passed in both demo and production mode.");