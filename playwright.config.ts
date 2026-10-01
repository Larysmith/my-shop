import { defineConfig, devices } from "@playwright/test";

/**
 * One dev server, booted in the mode the current run needs.
 *
 * Demo and production are mutually exclusive at runtime, and the flag is inlined
 * into the client bundle at compile time — so a single server cannot satisfy both
 * suites. `scripts/run-e2e.mjs` therefore invokes Playwright twice, once per mode.
 *
 * It is one server rather than two because Next refuses to run a second `next dev`
 * against the same directory, even on a different port.
 *
 * `NEXT_PUBLIC_*` in the process environment overrides `.env.local`, so the mode
 * below wins over whatever the local env file is parked in.
 */
const port = 3001;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // The dev server compiles routes on first request. With several workers
  // hitting dynamic routes at once, the default 5s is not enough and tests fail
  // non-deterministically. Raise it rather than patch individual assertions.
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE ?? "true",
    },
  },
});