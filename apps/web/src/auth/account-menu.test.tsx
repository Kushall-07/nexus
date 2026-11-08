// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

const redirectTo = vi.fn();
vi.mock("../lib/navigation", () => ({ redirectTo: (url: string) => redirectTo(url) }));

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (status: number, code: string, message = "x") =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status });

const overview = { analysis: null, categories: [] };
const me = { githubId: "42", username: "octocat" };

let routes: Record<string, Handler>;
let calls: Array<{ url: string; method: string }>;

beforeEach(() => {
  calls = [];
  redirectTo.mockReset();
  routes = {
    "/api/auth/me": () => ok(me),
    "/api/auth/logout": () => ok({ message: "Logged out successfully." }),
    "/api/skills": () => ok(overview),
    "/api/roles": () => ok({ catalogVersion: "1", roles: [] }),
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    const route = routes[url];
    return route ? route(url, init) : fail(404, "NOT_FOUND");
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(path = "/skills") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const trigger = () => screen.findByRole("button", { name: /Account menu for octocat/ });

describe("header account control", () => {
  it("shows a loading state, then the real identity, and requests /me once", async () => {
    mount();

    expect(screen.getByText("Checking session...")).toBeTruthy();
    expect(screen.queryByText("octocat")).toBeNull();
    expect(await trigger()).toBeTruthy();
    expect(screen.getByRole("button", { name: /Account menu for octocat/ })).toBeTruthy();
    expect(calls.filter((call) => call.url === "/api/auth/me")).toHaveLength(1);
  });

  it("shows Sign in with GitHub in the header when signed out, with no protected requests", async () => {
    routes["/api/auth/me"] = () => fail(401, "UNAUTHORIZED");
    mount();

    const links = await screen.findAllByRole("link", { name: "Sign in with GitHub" });
    expect(links.every((link) => link.getAttribute("href") === "/api/auth/github")).toBe(true);
    expect(screen.queryByRole("button", { name: /Account menu/ })).toBeNull();
    expect(calls.some((call) => call.url === "/api/skills")).toBe(false);
  });

  it("does not claim signed-out when the session check fails for a non-401 reason", async () => {
    routes["/api/auth/me"] = () => fail(500, "INTERNAL_ERROR", "down");
    mount();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Sign in to view your evidence")).toBeNull();
  });

  it("opens and closes with the button, Escape and outside click, with expanded state", async () => {
    const user = userEvent.setup();
    mount();
    const button = await trigger();

    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Connected through GitHub")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Switch GitHub account" })).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);

    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("supports arrow-key navigation between menu items", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await trigger());

    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Switch GitHub account" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Sign out" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Switch GitHub account" }));
  });

  it("keeps the existing navigation", async () => {
    mount();
    await trigger();
    for (const name of ["GitHub Evidence", "Skill Intelligence", "Role & Gap Analysis"]) {
      expect(screen.getByRole("link", { name })).toBeTruthy();
    }
  });
});

describe("sign out", () => {
  it("POSTs to the logout endpoint, then shows signed-out state with no stale identity", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await trigger());
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect((await screen.findAllByRole("link", { name: "Sign in with GitHub" })).length).toBeGreaterThan(0);
    expect(calls).toContainEqual({ url: "/api/auth/logout", method: "POST" });
    expect(screen.queryByText("octocat")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not claim success when logout fails, and keeps the session", async () => {
    routes["/api/auth/logout"] = () => fail(500, "INTERNAL_ERROR");
    const user = userEvent.setup();
    mount();
    await user.click(await trigger());
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not sign out/);
    expect(screen.getByRole("button", { name: /Account menu for octocat/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign in with GitHub" })).toBeNull();
    expect((screen.getByRole("menuitem", { name: "Sign out" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("sends one logout for repeated clicks while pending", async () => {
    let release!: () => void;
    routes["/api/auth/logout"] = () => new Promise<Response>((resolve) => { release = () => resolve(ok({ message: "ok" })); });
    const user = userEvent.setup();
    mount();
    await user.click(await trigger());
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    const pendingItem = screen.getByRole("menuitem", { name: "Signing out..." }) as HTMLButtonElement;
    expect(pendingItem.disabled).toBe(true);
    await user.click(pendingItem);
    release();
    await screen.findAllByRole("link", { name: "Sign in with GitHub" });

    expect(calls.filter((call) => call.url === "/api/auth/logout")).toHaveLength(1);
  });
});

describe("switch GitHub account", () => {
  it("ends the session, then starts a fresh OAuth flow requesting the account picker", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await trigger());
    await user.click(screen.getByRole("menuitem", { name: "Switch GitHub account" }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/api/auth/github?switch=1"));
    expect(calls).toContainEqual({ url: "/api/auth/logout", method: "POST" });
    expect(screen.queryByText("octocat")).toBeNull();
    expect(redirectTo).toHaveBeenCalledTimes(1);
  });

  it("does not start OAuth if the logout was not confirmed", async () => {
    routes["/api/auth/logout"] = () => fail(500, "INTERNAL_ERROR");
    const user = userEvent.setup();
    mount();
    await user.click(await trigger());
    await user.click(screen.getByRole("menuitem", { name: "Switch GitHub account" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not sign out/);
    expect(redirectTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Account menu for octocat/ })).toBeTruthy();
  });
});

describe("expired sessions and cancelled sign-in", () => {
  it("returns to the signed-out state when a data request reports an expired session", async () => {
    routes["/api/skills"] = () => fail(401, "UNAUTHORIZED", "Invalid or expired session.");
    mount("/skills");

    expect((await screen.findAllByRole("link", { name: "Sign in with GitHub" })).length).toBeGreaterThan(0);
    expect(screen.queryByText("octocat")).toBeNull();
    expect(screen.queryByRole("button", { name: /Account menu/ })).toBeNull();
  });

  it("shows a neutral notice after a cancelled GitHub sign-in and stays signed out", async () => {
    routes["/api/auth/me"] = () => fail(401, "UNAUTHORIZED");
    window.history.replaceState(null, "", "/?auth_error=cancelled");
    mount();

    expect(await screen.findByText(/sign-in was cancelled/)).toBeTruthy();
    expect(window.location.search).toBe("");
    expect(screen.queryByText("octocat")).toBeNull();
  });
});
