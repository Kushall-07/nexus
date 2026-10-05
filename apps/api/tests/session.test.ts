import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import {
  createSessionToken,
  verifySessionToken,
} from "../src/services/session.service.js";

describe("session service", () => {
  it("creates a JWT that verifies back to the original identity", () => {
    const token = createSessionToken({ sub: "user-id-123", githubId: "456" });

    const payload = verifySessionToken(token);

    expect(payload).toEqual({ sub: "user-id-123", githubId: "456" });
  });

  it("does not include a GitHub access token or encrypted token in the JWT", () => {
    const token = createSessionToken({ sub: "user-id-123", githubId: "456" });

    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded).not.toHaveProperty("accessToken");
    expect(decoded).not.toHaveProperty("githubToken");
    expect(decoded).not.toHaveProperty("encryptedGithubToken");
    expect(Object.keys(decoded).sort()).toEqual(
      ["githubId", "sub", "iat", "exp"].sort(),
    );
  });

  it("rejects a token signed with the wrong secret", () => {
    const badToken = jwt.sign(
      { sub: "user-id-123", githubId: "456" },
      "a-completely-different-secret-value",
    );

    expect(() => verifySessionToken(badToken)).toThrow();
  });

  it("rejects an expired token", () => {
    const expiredToken = jwt.sign(
      { sub: "user-id-123", githubId: "456" },
      env.JWT_SECRET,
      { expiresIn: -10 },
    );

    expect(() => verifySessionToken(expiredToken)).toThrow();
  });

  it("rejects a malformed token", () => {
    expect(() => verifySessionToken("not.a.jwt")).toThrow();
  });

  it("rejects a token missing required identity fields", () => {
    const incompleteToken = jwt.sign({ sub: "user-id-123" }, env.JWT_SECRET);

    expect(() => verifySessionToken(incompleteToken)).toThrow();
  });
});
