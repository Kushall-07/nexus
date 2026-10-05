import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { SESSION_TOKEN_EXPIRES_IN } from "../config/auth.config.js";

const sessionPayloadSchema = z.object({
  sub: z.string().min(1),
  githubId: z.string().min(1),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: SESSION_TOKEN_EXPIRES_IN,
  });
}

export function verifySessionToken(token: string): SessionPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  return sessionPayloadSchema.parse(decoded);
}
