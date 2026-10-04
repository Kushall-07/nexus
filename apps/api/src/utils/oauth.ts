import crypto from "node:crypto";

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}
