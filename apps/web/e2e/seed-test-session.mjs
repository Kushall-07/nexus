/**
 * Phase 6C E2E seed script.
 *
 * Creates (or reuses) the sandboxed E2E test user in the nexus_e2e MongoDB
 * database and writes a valid JWT session token to stdout.
 *
 * SAFETY CONTRACT:
 *   - Reads ONLY from process.env.  NEVER reads from the root .env file.
 *   - Requires MONGODB_URI to contain "nexus_e2e" or aborts immediately.
 *   - Requires MONGODB_URI to target localhost or 127.0.0.1 or aborts.
 *   - Must be called with the env vars pre-populated by global-setup.ts.
 *   - Is NOT safe to call standalone without the validated environment.
 *
 * Usage:  (spawned by global-setup.ts with correct process.env)
 * Output: a single line containing the JWT (stdout); errors go to stderr.
 */

import { createCipheriv, randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// ── Safety guard ─────────────────────────────────────────────────────────────

const APPROVED_E2E_PORT = 27018;

function assertSafeUri(uri) {
  if (!uri || uri.trim() === "") {
    process.stderr.write("[seed] MONGODB_URI is missing or empty. Aborting.\n");
    process.exit(1);
  }

  const hasLocalhost = /(?:^|@|\/\/)(?:localhost|127\.0\.0\.1)/.test(uri);
  if (!hasLocalhost) {
    process.stderr.write(
      "[seed] MONGODB_URI must target localhost or 127.0.0.1. " +
        "Refusing to seed a non-local database.\n",
    );
    process.exit(1);
  }

  // Extract db name from URI path
  const withoutProto = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const slashIndex = withoutProto.indexOf("/");
  if (slashIndex === -1) {
    process.stderr.write("[seed] MONGODB_URI has no database name. Aborting.\n");
    process.exit(1);
  }
  const dbName = withoutProto.slice(slashIndex + 1).split("?")[0].split("/")[0].trim();
  if (!dbName) {
    process.stderr.write("[seed] MONGODB_URI has an empty database name. Aborting.\n");
    process.exit(1);
  }
  if (dbName !== "nexus_e2e") {
    process.stderr.write(
      `[seed] MONGODB_URI points to "${dbName}" — only "nexus_e2e" is permitted.\n` +
        "[seed] Refusing to mutate a non-E2E database.\n",
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
      `[seed] MONGODB_URI must use port ${APPROVED_E2E_PORT} (nexus-mongodb-e2e). ` +
        `Got port ${port ?? "none"}. Port 27017 is the development database.\n`,
    );
    process.exit(1);
  }
}

// ── Token encryption (mirrors apps/api/src/utils/token-encryption.ts) ────────

function encryptToken(plaintext, keyBase64) {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    process.stderr.write(
      "[seed] TOKEN_ENCRYPTION_KEY does not decode to 32 bytes. Aborting.\n",
    );
    process.exit(1);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

// ── Minimal User schema (mirrors apps/api/src/models/user.model.ts) ───────────

const userSchema = new mongoose.Schema(
  {
    githubId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, trim: true },
    encryptedGithubToken: { type: String, required: true, select: false },
    selectedRepositoryCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

const UserModel = mongoose.models.User ?? mongoose.model("User", userSchema);

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Require env vars from process.env — global-setup.ts must have set them.
  const mongoUri = process.env.MONGODB_URI ?? "";
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY ?? "";

  if (!jwtSecret || jwtSecret.length < 32) {
    process.stderr.write("[seed] JWT_SECRET is missing or shorter than 32 chars. Aborting.\n");
    process.exit(1);
  }
  if (!encryptionKey) {
    process.stderr.write("[seed] TOKEN_ENCRYPTION_KEY is missing. Aborting.\n");
    process.exit(1);
  }

  // Safety guard — must pass before any DB mutation
  assertSafeUri(mongoUri);

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });

  // Upsert a stable test user; dummy encrypted token wraps the literal string
  // "e2e-dummy-token".  The API will get a GITHUB_TOKEN_EXPIRED error if the
  // test user's repositories are requested, which is expected and tested.
  const encryptedToken = encryptToken("e2e-dummy-token", encryptionKey);

  const user = await UserModel.findOneAndUpdate(
    { githubId: "e2e-test-user" },
    { username: "e2e-test-user", encryptedGithubToken: encryptedToken },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Fixed JTI derived from a deterministic string — unique within E2E.
  // Teardown removes the revoked_sessions collection so stale revocations
  // from prior runs never block a fresh session.
  const jti = createHash("sha256").update("e2e-fixed-session-phase6c").digest("hex");

  const token = jwt.sign(
    { sub: user._id.toString(), githubId: user.githubId },
    jwtSecret,
    { expiresIn: "24h", jwtid: jti },
  );

  // Single line of output — the JWT
  process.stdout.write(token + "\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  // Log only the error name/message — never the full stack which might echo env vars
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[seed] Error: ${msg}\n`);
  process.exit(1);
});
