/**
 * Phase 6C Playwright global teardown.
 *
 * Executed ONCE after all tests complete (pass or fail).
 *
 * Responsibilities:
 *   1. Re-validate that process.env.MONGODB_URI is still nexus_e2e on
 *      localhost (defense-in-depth: should already be set by global-setup).
 *   2. Spawn teardown-e2e-db.mjs to delete all E2E-owned documents from
 *      nexus_e2e.  NEVER touches the development database.
 *   3. Remove the .session-token file.
 *
 * If cleanup fails, the error is reported to stderr but does NOT re-throw
 * (so a cleanup failure does not mask real test failures).  Cleanup failures
 * are always visible in CI output.
 *
 * Manual recovery:
 *   If E2E cleanup fails or the process is killed mid-run, you can manually
 *   clean the abandoned nexus_e2e database:
 *
 *     mongosh mongodb://127.0.0.1:27017/nexus_e2e
 *     > db.users.deleteMany({})
 *     > db.career_profiles.deleteMany({})
 *     > db.saved_jobs.deleteMany({})
 *     > db.revoked_sessions.deleteMany({})
 *     > db.dropDatabase()   // safe: this is the isolated E2E database
 *
 *   The nexus (development) database is NEVER affected by these commands.
 */

import { rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SESSION_TOKEN_PATH = path.join(__dirname, ".session-token");
const TEARDOWN_SCRIPT_PATH = path.join(__dirname, "teardown-e2e-db.mjs");

// ── Inline DB safety guard (mirrors db-safety.ts assertE2EDatabase) ──────────

const APPROVED_E2E_PORT = 27018;

function assertE2EUri(uri: string): void {
  if (!uri || uri.trim() === "") {
    throw new Error("[global-teardown] MONGODB_URI is missing or empty.");
  }
  const hasLocalhost = /(?:^|@|\/\/)(?:localhost|127\.0\.0\.1)/.test(uri);
  if (!hasLocalhost) {
    throw new Error(
      "[global-teardown] MONGODB_URI does not target localhost. Refusing to clean.",
    );
  }
  const withoutProto = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const slashIndex = withoutProto.indexOf("/");
  const dbName =
    slashIndex === -1
      ? ""
      : withoutProto.slice(slashIndex + 1).split("?")[0].split("/")[0].trim();
  if (dbName !== "nexus_e2e") {
    throw new Error(
      `[global-teardown] MONGODB_URI points to "${dbName}" — only "nexus_e2e" is permitted.`,
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
      `[global-teardown] MONGODB_URI must use port ${APPROVED_E2E_PORT} (nexus-mongodb-e2e). ` +
        `Got port ${port ?? "none"}. Refusing to clean.`,
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function globalTeardown(): Promise<void> {
  let cleanupOk = false;

  try {
    // ── Step 1: Validate URI from inherited process.env ─────────────────
    const mongoUri = process.env.MONGODB_URI ?? "";
    assertE2EUri(mongoUri);

    // ── Step 2: Run the DB cleanup script ───────────────────────────────
    const output = execSync(`node "${TEARDOWN_SCRIPT_PATH}"`, {
      encoding: "utf8",
      timeout: 30_000,
      env: process.env,
    });
    console.log(output.trim());
    cleanupOk = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Report but do not re-throw — a cleanup failure must not hide test results
    process.stderr.write(`[global-teardown] DB cleanup failed: ${msg}\n`);
    process.stderr.write(
      "[global-teardown] You may need to manually clean the nexus_e2e database.\n" +
        "[global-teardown] See the teardown comment block for mongosh instructions.\n",
    );
  }

  // ── Step 3: Remove the session token file ────────────────────────────
  try {
    if (existsSync(SESSION_TOKEN_PATH)) {
      rmSync(SESSION_TOKEN_PATH);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[global-teardown] Could not remove .session-token: ${msg}\n`);
  }

  if (cleanupOk) {
    console.log("[global-teardown] E2E teardown complete. nexus_e2e cleaned.");
  } else {
    console.log("[global-teardown] E2E teardown finished with errors (see above).");
  }
}
