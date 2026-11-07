import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 6C Playwright configuration — isolated E2E environment.
 *
 * Port map:
 *   Development API     : 4000  (unchanged, started separately by npm run dev)
 *   E2E API             : 4001  (started by webServer below)
 *   Development frontend: 5173  (unchanged, started separately by npm run dev)
 *   E2E frontend        : 5174  (started by webServer below, via vite.e2e.config.ts)
 *
 * Lifecycle:
 *   0. This config file loads e2e/.env.test into process.env immediately so that
 *      webServer child processes inherit the correct E2E vars (PORT=4001, etc.).
 *      Playwright 1.52+ runs webServer plugin setup BEFORE globalSetup, so the
 *      config file must be responsible for populating process.env early enough.
 *   1. globalSetup runs — validates nexus_e2e URI, seeds the test user,
 *      writes e2e/.session-token.  URI safety checks remain as defense-in-depth.
 *   2. webServer starts — API on 4001, Vite on 5174.  Both processes inherit
 *      process.env already set in step 0.
 *   3. Tests run against http://localhost:5174 / http://localhost:4001.
 *   4. globalTeardown runs — cleans nexus_e2e, removes .session-token.
 *
 * reuseExistingServer: false on both servers means Playwright will error
 * immediately if either port is already occupied, preventing accidental use
 * of a running development server.
 */

// ── Load e2e/.env.test early so webServer child processes get the correct vars ──
// webServer is a plugin that starts BEFORE globalSetup in Playwright's task order.
// Without this early load, the API webServer inherits the outer process.env (which
// may contain PORT=4000 from the user's shell or root .env), and starts on the
// wrong port.  globalSetup still validates the URI independently (defense-in-depth).
(function loadE2EEnv() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(__dirname, "e2e", ".env.test");
  if (!existsSync(envPath)) {
    // Surface the error immediately — do not silently skip.
    throw new Error(
      `[playwright.config] E2E environment file not found: ${envPath}\n` +
        "Create apps/web/e2e/.env.test before running E2E tests.",
    );
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawVal = trimmed.slice(eqIndex + 1).trim();
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (key) {
      // Set without override: pre-existing vars (e.g. CI-injected secrets) win.
      // All keys from .env.test are set so webServer child processes inherit them.
      process.env[key] = process.env[key] ?? val;
    }
  }
})();

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e/results.json" }]],

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    // E2E frontend (vite.e2e.config.ts → port 5174, proxy /api → 4001)
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 } },
    },
  ],

  webServer: [
    {
      // E2E API — port 4001, connects to nexus_e2e.
      // Inherits process.env pre-populated by the loadE2EEnv() IIFE above.
      // dotenv.config() in env.ts will not override already-set vars, so the
      // root .env is effectively bypassed.
      command: "npm run e2e-start --workspace=apps/api",
      cwd: "../../",   // repo root (relative to this config file at apps/web/)
      url: "http://localhost:4001/health",
      timeout: 30_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // E2E Vite dev server — port 5174, proxies /api to localhost:4001.
      command: "npm run e2e:dev",
      // cwd defaults to apps/web/ (the directory of this config file) ✓
      url: "http://localhost:5174",
      timeout: 30_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
