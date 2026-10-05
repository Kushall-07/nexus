import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { SESSION_COOKIE_NAME } from "../src/config/auth.config.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requireAuth } from "../src/middleware/require-auth.js";
import { createSessionToken } from "../src/services/session.service.js";

function buildTestApp() {
  const testApp = express();
  testApp.use(cookieParser());

  testApp.get("/protected", requireAuth, (req, res) => {
    res.status(200).json({ success: true, data: { user: req.user } });
  });

  testApp.use(errorHandler);

  return testApp;
}

describe("requireAuth middleware", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(buildTestApp()).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a request with an invalid session cookie", async () => {
    const response = await request(buildTestApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=not-a-valid-jwt`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a request with an expired session cookie", async () => {
    const expiredToken = jwt.sign(
      { sub: "user-id-123", githubId: "456" },
      env.JWT_SECRET,
      { expiresIn: -10 },
    );

    const response = await request(buildTestApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows a request with a valid session cookie and exposes the user context", async () => {
    const token = createSessionToken({ sub: "user-id-123", githubId: "456" });

    const response = await request(buildTestApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({ id: "user-id-123", githubId: "456" });
  });
});
