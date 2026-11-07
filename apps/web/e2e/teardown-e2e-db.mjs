/**
 * Phase 6C E2E teardown script.
 *
 * Removes all data created during an E2E test run from the nexus_e2e database.
 * Called by global-teardown.ts after every Playwright run (pass or fail).
 *
 * SAFETY CONTRACT:
 *   - Reads ONLY from process.env.  NEVER reads from the root .env file.
 *   - Requires MONGODB_URI to be "nexus_e2e" on localhost or aborts immediately.
 *   - Performs ONLY targeted deletes (by e2e-test-user identity) or collection
 *     deletes on collections that are entirely E2E-owned in this database.
 *   - NEVER drops the entire database.
 *   - NEVER touches any database other than nexus_e2e.
 *
 * Output: cleanup summary on stdout (counts only, no credentials).
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

// ── Safety guard ─────────────────────────────────────────────────────────────

const APPROVED_E2E_PORT = 27018;

function assertSafeUri(uri) {
  if (!uri || uri.trim() === "") {
    process.stderr.write("[teardown] MONGODB_URI is missing or empty. Aborting.\n");
    process.exit(1);
  }

  const hasLocalhost = /(?:^|@|\/\/)(?:localhost|127\.0\.0\.1)/.test(uri);
  if (!hasLocalhost) {
    process.stderr.write(
      "[teardown] MONGODB_URI must target localhost or 127.0.0.1. " +
        "Refusing to clean a non-local database.\n",
    );
    process.exit(1);
  }

  const withoutProto = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const slashIndex = withoutProto.indexOf("/");
  if (slashIndex === -1) {
    process.stderr.write("[teardown] MONGODB_URI has no database name. Aborting.\n");
    process.exit(1);
  }
  const dbName = withoutProto.slice(slashIndex + 1).split("?")[0].split("/")[0].trim();
  if (!dbName) {
    process.stderr.write("[teardown] MONGODB_URI has an empty database name. Aborting.\n");
    process.exit(1);
  }
  if (dbName !== "nexus_e2e") {
    process.stderr.write(
      `[teardown] MONGODB_URI points to "${dbName}" — only "nexus_e2e" is permitted.\n` +
        "[teardown] Refusing to clean a non-E2E database.\n",
    );
    process.exit(1);
  }

  // Port check: must be the dedicated E2E port 27018, not the dev port 27017
  const atIndex = withoutProto.indexOf("@");
  const hostSection = atIndex === -1
    ? withoutProto.split("/")[0]
    : withoutProto.slice(atIndex + 1).split("/")[0];
  const colonIndex = hostSection.lastIndexOf(":");
  const port = colonIndex === -1 ? null : parseInt(hostSection.slice(colonIndex + 1), 10);
  if (port !== APPROVED_E2E_PORT) {
    process.stderr.write(
      `[teardown] MONGODB_URI must use port ${APPROVED_E2E_PORT} (nexus-mongodb-e2e). ` +
        `Got port ${port ?? "none"}. Port 27017 is the development database.\n`,
    );
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri = process.env.MONGODB_URI ?? "";
  assertSafeUri(mongoUri);

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });

  const db = mongoose.connection.db;

  // 1. Find the E2E test user (may not exist if setup failed before seeding)
  const usersCol = db.collection("users");
  const user = await usersCol.findOne({ githubId: "e2e-test-user" });

  let deletedUsers = 0;
  let deletedCareerProfiles = 0;
  let deletedSavedJobs = 0;
  let deletedRevokedSessions = 0;
  let deletedAnalyses = 0;
  let deletedEvidence = 0;
  let deletedRepositories = 0;

  if (user) {
    const userId = user._id;

    // 2. Delete all data owned by the E2E test user
    const cpResult = await db.collection("career_profiles").deleteMany({ userId });
    deletedCareerProfiles = cpResult.deletedCount ?? 0;

    const sjResult = await db.collection("saved_jobs").deleteMany({ userId });
    deletedSavedJobs = sjResult.deletedCount ?? 0;

    const anResult = await db.collection("analyses").deleteMany({ userId });
    deletedAnalyses = anResult.deletedCount ?? 0;

    const evResult = await db.collection("evidence").deleteMany({ userId });
    deletedEvidence = evResult.deletedCount ?? 0;

    const repoResult = await db.collection("repositories").deleteMany({ userId });
    deletedRepositories = repoResult.deletedCount ?? 0;

    // 3. Delete the user document last
    const uResult = await usersCol.deleteOne({ _id: userId });
    deletedUsers = uResult.deletedCount ?? 0;
  }

  // 4. revoked_sessions: all entries are E2E-owned in nexus_e2e (validated above)
  const rsResult = await db.collection("revoked_sessions").deleteMany({});
  deletedRevokedSessions = rsResult.deletedCount ?? 0;

  await mongoose.disconnect();

  process.stdout.write(
    "[teardown] Cleanup complete: " +
      `users=${deletedUsers} ` +
      `career_profiles=${deletedCareerProfiles} ` +
      `saved_jobs=${deletedSavedJobs} ` +
      `analyses=${deletedAnalyses} ` +
      `evidence=${deletedEvidence} ` +
      `repositories=${deletedRepositories} ` +
      `revoked_sessions=${deletedRevokedSessions}\n`,
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[teardown] Error: ${msg}\n`);
  process.exit(1);
});
