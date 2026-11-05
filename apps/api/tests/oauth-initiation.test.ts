import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("GET /api/auth/github", () => {
  it("redirects to GitHub's authorization endpoint with the expected parameters", async () => {
    const response = await request(app).get("/api/auth/github");

    expect(response.status).toBe(302);

    const location = new URL(response.headers.location);

    expect(`${location.protocol}//${location.host}${location.pathname}`).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(location.searchParams.get("client_id")).toBe(env.GITHUB_CLIENT_ID);
    expect(location.searchParams.get("redirect_uri")).toBe(
      `${env.BACKEND_URL}/api/auth/github/callback`,
    );
    expect(location.searchParams.get("scope")).toBe("read:user user:email");
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("does not force the account picker by default", async () => {
    const response = await request(app).get("/api/auth/github");

    expect(new URL(response.headers.location).searchParams.has("prompt")).toBe(false);
  });

  it("forces GitHub's account picker for an account switch, keeping state validation", async () => {
    const response = await request(app).get("/api/auth/github?switch=1");
    const location = new URL(response.headers.location);

    expect(location.searchParams.get("prompt")).toBe("select_account");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("redirect_uri")).toBe(`${env.BACKEND_URL}/api/auth/github/callback`);
    expect((response.headers["set-cookie"] as unknown as string[]).some((c) => c.startsWith("github_oauth_state="))).toBe(true);
  });

  it("ignores any other switch value", async () => {
    const response = await request(app).get("/api/auth/github?switch=select_account&prompt=login");

    expect(new URL(response.headers.location).searchParams.has("prompt")).toBe(false);
  });

  it("sets a secure, http-only state cookie", async () => {
    const response = await request(app).get("/api/auth/github");

    const setCookieHeader = response.headers["set-cookie"] as unknown as string[];
    const stateCookie = setCookieHeader.find((cookie) =>
      cookie.startsWith("github_oauth_state="),
    );

    expect(stateCookie).toBeDefined();
    expect(stateCookie).toMatch(/HttpOnly/i);
    expect(stateCookie).toMatch(/SameSite=Lax/i);
  });

  it("generates a different state value on each request", async () => {
    const first = await request(app).get("/api/auth/github");
    const second = await request(app).get("/api/auth/github");

    const firstState = new URL(first.headers.location).searchParams.get("state");
    const secondState = new URL(second.headers.location).searchParams.get("state");

    expect(firstState).not.toBe(secondState);
  });
});
