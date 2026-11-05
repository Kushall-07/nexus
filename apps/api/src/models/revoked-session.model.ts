import { Schema, model } from "mongoose";

// SHA-256 fingerprint of a logged-out session token (never the token itself).
// MongoDB removes the row once the token would have expired anyway.
const revokedSessionSchema = new Schema(
  {
    fingerprint: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "revoked_sessions", versionKey: false },
);

revokedSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedSessionModel = model("RevokedSession", revokedSessionSchema);
