// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../auth/AuthContext";
import { SettingsPage } from "./SettingsPage";

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

interface Call {
  method: string;
  url: string;
  body: unknown;
}

function stubNetwork(options: { deleteStatus?: number } = {}) {
  const calls: Call[] = [];
  let signedIn = true;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });

      if (url === "/api/auth/me") {
        return signedIn
          ? ok({ githubId: "1", username: "octocat" })
          : new Response(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "no" } }), { status: 401 });
      }
      if (url === "/api/opportunities/providers") {
        return ok({
          providers: [
            { id: "remotive", label: "Remotive", configured: false, hint: "Set REMOTIVE_ENABLED=true." },
            { id: "adzuna", label: "Adzuna", configured: true },
          ],
          llm: { configured: false },
        });
      }
      if (url === "/api/auth/account" && method === "DELETE") {
        if (options.deleteStatus && options.deleteStatus !== 200) {
          return new Response(JSON.stringify({ success: false, error: { code: "MONGODB_ERROR", message: "Could not delete." } }), {
            status: options.deleteStatus,
          });
        }
        signedIn = false;
        return ok({ deleted: { user: 1 } });
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    }),
  );

  return calls;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Settings page", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => cleanup());

  it("shows which integrations are configured without exposing secrets", async () => {
    stubNetwork();
    renderPage();

    expect(await screen.findByText("Remotive")).toBeTruthy();
    expect(screen.getByText("Adzuna")).toBeTruthy();
    expect(screen.getAllByText(/Not configured/).length).toBe(2);
    expect(screen.getByText(/✓ Configured/)).toBeTruthy();
    expect(screen.getByText("Set REMOTIVE_ENABLED=true.")).toBeTruthy();
  });

  it("only deletes after the exact phrase is typed, then signs the user out", async () => {
    const calls = stubNetwork();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Delete my data/ }));
    const confirm = screen.getByRole("button", { name: "Permanently delete" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await user.type(screen.getByLabelText(/Type/), "delete my data");
    expect(confirm.disabled).toBe(true);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);

    await user.clear(screen.getByLabelText(/Type/));
    await user.type(screen.getByLabelText(/Type/), "DELETE MY DATA");
    await user.click(confirm);

    await waitFor(() => expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1));
    expect(calls.find((call) => call.method === "DELETE")?.body).toEqual({ confirmation: "DELETE MY DATA" });
    // The auth layer re-checks the session after deletion.
    await waitFor(() => expect(calls.filter((call) => call.url === "/api/auth/me").length).toBeGreaterThan(1));
  });

  it("keeps the dialog open and reports the error when deletion fails", async () => {
    stubNetwork({ deleteStatus: 500 });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Delete my data/ }));
    await user.type(screen.getByLabelText(/Type/), "DELETE MY DATA");
    await user.click(screen.getByRole("button", { name: "Permanently delete" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Could not delete.");
    expect((screen.getByRole("button", { name: "Permanently delete" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
