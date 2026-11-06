/**
 * Creates (or reuses) a sandboxed E2E test user in the local MongoDB and returns
 * a valid JWT session token on stdout. Nothing is printed to stderr except errors.
 *
 * Usage:  node e2e/seed-test-session.mjs
 * Output: a single line containing the JWT (no other output)
 *
 * The test user is identifiable by githubId "e2e-test-user" and is never used
 * for real GitHub calls.  It is safe to leave in the dev DB between runs.
 */

import { readFileSync } from "node:fs";
import { createCipheriv, randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// ── Load .env from repo root ─────────────────────────────────────────────────
function readEnv() {
  const root = path.resolve(fileURLToPath(import.meta.url), "../../../../");
  const lines = readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

// ── Minimal token encryption (mirrors apps/api/src/utils/token-encryption.ts) ─
function encryptToken(plaintext, keyBase64) {
  const key = Buffer.from(keyBase64, "base64");
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
// Use existing compiled model if already registered (re-entrancy guard)
const UserModel = mongoose.models.User ?? mongoose.model("User", userSchema);

async function main() {
  const env = readEnv();
  const mongoUri = env.MONGODB_URI || "mongodb://localhost:27017/nexus";
  const jwtSecret = env.JWT_SECRET;
  const encryptionKey = env.TOKEN_ENCRYPTION_KEY;

  if (!jwtSecret || !encryptionKey) {
    process.stderr.write("Missing JWT_SECRET or TOKEN_ENCRYPTION_KEY in .env\n");
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { dbName: undefined });

  // Upsert a stable test user; dummy encrypted token wraps the literal string "e2e-dummy-token"
  const encryptedToken = encryptToken("e2e-dummy-token", encryptionKey);

  const user = await UserModel.findOneAndUpdate(
    { githubId: "e2e-test-user" },
    { username: "e2e-test-user", encryptedGithubToken: encryptedToken },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const token = jwt.sign(
    { sub: user._id.toString(), githubId: user.githubId },
    jwtSecret,
    { expiresIn: "1h", jwtid: createHash("sha256").update("e2e-fixed-session").digest("hex") },
  );

  // Single line of output — the JWT
  process.stdout.write(token + "\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(String(err) + "\n");
  process.exit(1);
});
