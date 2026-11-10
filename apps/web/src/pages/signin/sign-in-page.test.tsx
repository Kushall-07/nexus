// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";

vi.mock("../../lib/navigation", () => ({ redirectTo: vi.fn() }));

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (status: number, code: string, message = "x") =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status });

const me = { githubId: "42", username: "octocat" };

let routes: Record<string, Handler>;

beforeEach(() => {
  routes = {
    "/api/auth/me": () => fail(401, "UNAUTHORIZED"),
    "/api/auth/logout": () => ok({ message: "Logged out successfully." }),
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const route = routes[url];
    return route ? route(url, init) : fail(404, "NOT_FOUND");
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function mount(path = "/signin") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("SignInPage — unauthenticated visitor", () => {
  it("shows Sign up and Sign in links pointing to the GitHub OAuth endpoint", async () => {
    mount();

    const signUpLink = await screen.findByRole("link", { name: /sign up with github/i });
    const signInLink = await screen.findByRole("link", { name: /sign in with github/i });

    expect((signUpLink as HTMLAnchorElement).href).toContain("/api/auth/github");
    expect((signInLink as HTMLAnchorElement).href).toContain("/api/auth/github");
  });

  it("displays the NEXUS brand", async () => {
    mount();
    await screen.findByRole("link", { name: /sign in with github/i });
    expect(screen.getByRole("link", { name: /nexus home/i })).toBeTruthy();
  });
});

describe("SignInPage — authenticated visitor", () => {
  it("redirects an already-authenticated user to /dashboard without showing the sign-in UI", async () => {
    routes["/api/auth/me"] = () => ok(me);
    routes["/api/skills"] = () => ok({ analysis: null, categories: [] });
    routes["/api/roles"] = () => ok({ catalogVersion: "1", roles: [] });

    mount();

    // The dashboard route renders under AuthGate — wait for it to load.
    // The sign-in links must NOT appear.
    await screen.findByRole("navigation", { name: "Primary navigation" });
    expect(screen.queryByRole("link", { name: /sign up with github/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /sign in with github/i })).toBeNull();
  });
});

describe("SignInPage — cancelled GitHub sign-in notice", () => {
  it("shows the cancellation notice and strips the query param from the URL", async () => {
    window.history.replaceState(null, "", "/signin?auth_error=cancelled");
    mount();

    expect(await screen.findByText(/sign-in was cancelled/i)).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("renders the sign-in links even after a cancelled attempt", async () => {
    window.history.replaceState(null, "", "/signin?auth_error=cancelled");
    mount();

    expect(await screen.findByRole("link", { name: /sign in with github/i })).toBeTruthy();
  });
});

describe("SignInPage — after logout redirect", () => {
  it("unauthenticated user reaching a protected route is redirected to /signin and sees the auth page", async () => {
    mount("/dashboard");

    const signInLink = await screen.findByRole("link", { name: /sign in with github/i });
    expect((signInLink as HTMLAnchorElement).href).toContain("/api/auth/github");
  });
});

describe("SignInPage — session isolation", () => {
  it("shows sign-in page (not stale account data) after /me returns 401", async () => {
    mount();

    await screen.findByRole("link", { name: /sign in with github/i });
    // No username from previous session should leak through
    expect(screen.queryByText("octocat")).toBeNull();
  });
});
