import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import { env } from "../config/env.js";
import { SESSION_TOKEN_EXPIRES_IN } from "../config/auth.config.js";
import { RevokedSessionModel } from "../models/revoked-session.model.js";

const sessionPayloadSchema = z.object({
  sub: z.string().min(1),
  githubId: z.string().min(1),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: SESSION_TOKEN_EXPIRES_IN,
    // Unique per login, so a fresh session can never equal a revoked one.
    jwtid: crypto.randomUUID(),
  });
}

// Session tokens are stateless JWTs, so clearing the cookie alone leaves a copied
// token valid until it expires. Logout therefore records a hash of the token here
// and verification rejects it. Verification reads an in-memory set; revocations
// are written through to MongoDB and loaded again at startup, so they survive a
// restart. Several API instances would each see another's revocations only after
// a restart (no cross-instance push), which is acceptable for a single instance.
const revokedTokens = new Map<string, number>();

function tokenFingerprint(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function pruneRevokedTokens(nowSeconds: number): void {
  for (const [fingerprint, exp] of revokedTokens) {
    if (exp <= nowSeconds) revokedTokens.delete(fingerprint);
  }
}

// Loads unexpired revocations written by earlier processes. Call once after the
// database connects.
export async function loadRevokedSessions(): Promise<number> {
  const rows = await RevokedSessionModel.find({ expiresAt: { $gt: new Date() } }).lean();

  for (const row of rows) {
    revokedTokens.set(row.fingerprint, Math.floor(row.expiresAt.getTime() / 1000));
  }

  return rows.length;
}

// Returns false when the token is not a valid session token (nothing to revoke).
// The in-memory revocation is immediate; persistence failure is reported to the
// caller so it can be logged, but never un-revokes the token for this process.
export async function revokeSessionToken(token: string): Promise<boolean> {
  let exp: number;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    exp = typeof decoded === "object" && typeof decoded.exp === "number" ? decoded.exp : 0;
  } catch {
    return false;
  }

  pruneRevokedTokens(Math.floor(Date.now() / 1000));
  const fingerprint = tokenFingerprint(token);
  revokedTokens.set(fingerprint, exp);

  if (mongoose.connection.readyState === 1) {
    await RevokedSessionModel.updateOne(
      { fingerprint },
      { $set: { expiresAt: new Date(exp * 1000) } },
      { upsert: true },
    );
  }

  return true;
}

export function verifySessionToken(token: string): SessionPayload {
  // Prune on every verification so the map cannot grow indefinitely in a
  // long-running process that stops receiving new logouts.
  pruneRevokedTokens(Math.floor(Date.now() / 1000));

  if (revokedTokens.has(tokenFingerprint(token))) {
    throw new Error("Session has been revoked.");
  }

  const decoded = jwt.verify(token, env.JWT_SECRET);

  return sessionPayloadSchema.parse(decoded);
}
