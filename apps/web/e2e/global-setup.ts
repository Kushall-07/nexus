/**
 * Phase 6C Playwright global setup.
 *
 * Executed ONCE before any test worker or webServer starts.
 *
 * Responsibilities:
 *   1. Load apps/web/e2e/.env.test — the dedicated E2E environment file.
 *      NEVER loads from the repository root .env.
 *   2. Validate MONGODB_URI: must be nexus_e2e on localhost.  Abort on any
 *      mismatch — the development database must never be touched.
 *   3. Set all E2E env vars in process.env so that the API and Vite
 *      webServer child processes inherit them (dotenv in env.ts will not
 *      override already-set vars, so the root .env is effectively bypassed).
 *   4. Run seed-test-session.mjs to upsert the E2E test user in nexus_e2e
 *      and mint a 24-hour JWT.
 *   5. Write the JWT to e2e/.session-token for tests to read.
 *
 * Session verification happens implicitly: the first E2E test that calls
 * GET /api/auth/me with the injected cookie is the live verification.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const E2E_ENV_PATH = path.join(__dirname, ".env.test");
const SESSION_TOKEN_PATH = path.join(__dirname, ".session-token");
const SEED_SCRIPT_PATH = path.join(__dirname, "seed-test-session.mjs");

// ── Environment file parser ───────────────────────────────────────────────────

/**
 * Parses a .env file into a key→value map.
 * Skips blank lines and comment lines (# ...).
 * Strips optional surrounding quotes from values.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawVal = trimmed.slice(eqIndex + 1).trim();
    // Strip optional surrounding single or double quotes
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (key) env[key] = val;
  }
  return env;
}

// ── Inline DB safety guard ────────────────────────────────────────────────────
//
// Mirrors the logic in apps/api/src/utils/db-safety.ts.
// Duplicated here because global-setup.ts must not import from apps/api/src/
// (different workspace, different TypeScript config).

const APPROVED_E2E_PORT = 27018;

function assertE2EUri(uri: string): void {
  if (!uri || uri.trim() === "") {
    throw new Error("[global-setup] MONGODB_URI is missing or empty.");
  }

  const hasLocalhost = /(?:^|@|\/\/)(?:localhost|127\.0\.0\.1)/.test(uri);
  if (!hasLocalhost) {
    throw new Error(
      "[global-setup] MONGODB_URI must target localhost or 127.0.0.1. " +
        "Remote hosts (including Atlas) are not permitted for E2E tests.",
    );
  }

  const withoutProto = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const slashIndex = withoutProto.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(
      "[global-setup] MONGODB_URI does not contain a database name.",
    );
  }
  const dbName = withoutProto.slice(slashIndex + 1).split("?")[0].split("/")[0].trim();

  if (!dbName) {
    throw new Error(
      "[global-setup] MONGODB_URI has an empty database name.",
    );
  }

  if (dbName !== "nexus_e2e") {
    throw new Error(
      `[global-setup] MONGODB_URI points to "${dbName}" — only "nexus_e2e" is permitted. ` +
        `Refusing to operate on "${dbName}" to protect the development database.`,
    );
  }

  // Port check: must be the dedicated E2E port, not the development port 27017
  const atIndex = withoutProto.indexOf("@");
  const hostSection = atIndex === -1
    ? withoutProto.split("/")[0]
    : withoutProto.slice(atIndex + 1).split("/")[0];
  const colonIndex = hostSection.lastIndexOf(":");
  const port = colonIndex === -1 ? null : parseInt(hostSection.slice(colonIndex + 1), 10);
  if (port !== APPROVED_E2E_PORT) {
    throw new Error(
      `[global-setup] MONGODB_URI must use port ${APPROVED_E2E_PORT} (nexus-mongodb-e2e container). ` +
        `Got port ${port ?? "none"}. Port 27017 maps to the development container.`,
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function globalSetup(): Promise<void> {
  // ── Step 1: Verify the E2E env file exists ──────────────────────────────
  if (!existsSync(E2E_ENV_PATH)) {
    throw new Error(
      `[global-setup] E2E environment file not found: ${E2E_ENV_PATH}\n` +
        "Create apps/web/e2e/.env.test before running E2E tests.",
    );
  }

  // ── Step 2: Parse the E2E env file ─────────────────────────────────────
  const e2eEnv = parseEnvFile(E2E_ENV_PATH);

  // ── Step 3: Validate the MongoDB URI before ANY mutation ────────────────
  const mongoUri = e2eEnv.MONGODB_URI ?? "";
  assertE2EUri(mongoUri);

  // ── Step 4: Set all E2E vars in process.env (with override) ────────────
  //   Child processes (webServer API, webServer Vite) will inherit these.
  //   dotenv.config() in apps/api/src/config/env.ts does NOT override
  //   already-set env vars, so the root .env is effectively bypassed.
  for (const [key, val] of Object.entries(e2eEnv)) {
    process.env[key] = val;
  }

  // Confirm we have the minimum required vars before going further
  const requiredVars = [
    "MONGODB_URI",
    "JWT_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "FRONTEND_URL",
    "BACKEND_URL",
  ] as const;

  const missing = requiredVars.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[global-setup] Missing required E2E env vars: ${missing.join(", ")}`,
    );
  }

  // ── Step 5: Run the seed script ─────────────────────────────────────────
  //   The script inherits process.env (now populated with E2E values).
  //   It connects to nexus_e2e, upserts the test user, writes JWT to stdout.
  console.log(`[global-setup] Seeding E2E database: ${mongoUri.replace(/\/\/.*@/, "//***@")}`);
  console.log(`[global-setup] API port: ${process.env.PORT ?? "4001"}`);
  console.log(`[global-setup] Frontend port: 5174`);
  console.log("[global-setup] Job providers: disabled");
  console.log("[global-setup] LLM: disabled");
  console.log("[global-setup] Development .env: excluded (all vars pre-set)");

  let token: string;
  try {
    token = execSync(`node "${SEED_SCRIPT_PATH}"`, {
      encoding: "utf8",
      timeout: 20_000,
      env: process.env, // explicitly pass current env to the subprocess
    }).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[global-setup] Seed script failed: ${msg}`);
  }

  if (!token || token.length < 20) {
    throw new Error(
      "[global-setup] Seed script produced no token. Check seed script output.",
    );
  }

  // ── Step 6: Write the session token for test workers to read ────────────
  writeFileSync(SESSION_TOKEN_PATH, token, "utf8");

  console.log("[global-setup] Session token written to e2e/.session-token");
  console.log("[global-setup] E2E setup complete.");
}
