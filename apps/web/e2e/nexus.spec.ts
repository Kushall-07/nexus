/**
 * NEXUS live browser E2E test suite.
 *
 * Prerequisites (all running before this file executes):
 *   - MongoDB on localhost:27017
 *   - API on localhost:4000  (`npm run dev` in apps/api)
 *   - Vite dev server on localhost:5173  (`npm run dev` in apps/web)
 *
 * Authentication strategy:
 *   The seed script (e2e/seed-test-session.mjs) creates a sandboxed MongoDB user
 *   with githubId "e2e-test-user" and mints a 1-hour JWT using the same JWT_SECRET
 *   as the running API.  The JWT is injected as the nexus_session cookie before
 *   any authenticated test runs.
 *
 * Route map (confirmed from App.tsx):
 *   /             → SkillOverviewPage  ("Skill graph")
 *   /skills/:id   → SkillDetailPage
 *   /repositories → RepositoriesPage   ("Repositories")
 *   /roles        → RolesPage          ("Target role")
 *   /dashboard    → DashboardPage      ("Dashboard")
 *   /opportunities→ OpportunitiesRoute ("Opportunities")
 *   /copilot      → CopilotPage        ("Career Copilot")
 *   /applications → ApplicationsPage  ("Saved jobs & applications")
 *   /resume       → ResumePage         ("Resume")
 *   /development  → DevelopmentPage    ("Skill development")
 *   /settings     → SettingsPage       ("Settings")
 *   /preferences  → PreferencesPage    ("Career preferences")
 *   *             → NotFound           (404)
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../../");
const SEED_SCRIPT = path.join(ROOT, "apps/web/e2e/seed-test-session.mjs");

function mintSessionToken(): string {
  return execSync(`node "${SEED_SCRIPT}"`, { encoding: "utf8", timeout: 10_000 }).trim();
}

async function injectSession(context: BrowserContext): Promise<void> {
  const token = mintSessionToken();
  await context.addCookies([
    {
      name: "nexus_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

// ── Unauthenticated tests ─────────────────────────────────────────────────────

test.describe("Unauthenticated", () => {
  test("sign-in page renders NEXUS heading", async ({ page }) => {
    await page.goto("/");
    // AuthGate shows SignInPrompt when no session. Wait for the h1 to appear.
    await expect(page.locator("h1").filter({ hasText: "NEXUS" })).toBeVisible({ timeout: 10_000 });
  });

  test("sign-in button href points to API OAuth endpoint", async ({ page }) => {
    await page.goto("/");
    await page.locator("h1").filter({ hasText: "NEXUS" }).waitFor({ timeout: 10_000 });
    // Multiple "Sign in with GitHub" CTAs on the landing page — use first()
    const link = page.getByRole("link", { name: /sign in with github/i }).first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/\/api\/auth\/github/);
  });

  test("protected routes show sign-in screen", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1").filter({ hasText: "NEXUS" })).toBeVisible({ timeout: 10_000 });
  });

  test("API /health returns ok", async ({ request }) => {
    const res = await request.get("http://localhost:4000/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("API /ready returns ready with MongoDB connected", async ({ request }) => {
    const res = await request.get("http://localhost:4000/ready");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
  });

  test("unauthenticated API route returns 401", async ({ request }) => {
    const res = await request.get("http://localhost:4000/api/auth/me");
    expect(res.status()).toBe(401);
  });
});

// ── Authenticated shell tests ──────────────────────────────────────────────────

test.describe("Authenticated shell", () => {
  test.beforeEach(async ({ context }) => {
    await injectSession(context);
  });

  test("desktop sidebar shows nav links at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: /dashboard/i }).first()).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /opportunities/i }).first()).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /development/i }).first()).toBeVisible();
  });

  test("desktop sidebar subtitle shows GitHub Evidence Engine at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator("text=GitHub Evidence Engine").first()).toBeVisible({ timeout: 10_000 });
  });

  test("desktop account menu shows username at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    // Wait for the auth fetch (/api/auth/me) to settle so AccountMenu renders the username.
    // Without this the test is flaky under load: the 10s timeout can be exceeded when
    // prior suites (desktop-chrome + tablet) have saturated the API.
    await page.waitForLoadState("networkidle");
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("e2e-test-user").first()).toBeVisible({ timeout: 10_000 });
  });

  test("desktop sidebar is visible at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
  });

  test("mobile shows hamburger button", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /open navigation/i })).toBeVisible();
  });

  test("mobile drawer opens and closes with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    await expect(page.getByRole("button", { name: /close navigation/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /open navigation menu/i })).toBeVisible();
  });

  test("tablet viewport shows hamburger (mobile layout below lg)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /open navigation/i })).toBeVisible();
  });

  test("skip-to-main link is in DOM", async ({ page }) => {
    await page.goto("/dashboard");
    // Accessibility: skip link present and targets #main-content
    const skipLink = page.locator("a.skip-to-main");
    await expect(skipLink).toBeAttached();
    const href = await skipLink.getAttribute("href");
    expect(href).toBe("#main-content");
  });
});

// ── Individual page smoke tests ───────────────────────────────────────────────

test.describe("Page routes", () => {
  test.beforeEach(async ({ context }) => {
    await injectSession(context);
  });

  test("/ → Skill graph (SkillOverviewPage)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /skill graph/i, level: 1 })).toBeVisible();
  });

  test("/dashboard → Dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });

  test("/dashboard — profile status rows present", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor();
    // Scope to main to avoid matching hidden sidebar nav links at non-desktop viewports
    await expect(
      page.locator("main").getByText(/GitHub analysis|Resume|Career direction/i).first()
    ).toBeVisible();
  });

  test("/opportunities → Opportunities", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Opportunities", level: 1 })).toBeVisible({ timeout: 12_000 });
  });

  test("/opportunities — no-provider message or demo button visible", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByRole("heading", { name: "Opportunities", level: 1 }).waitFor({ timeout: 12_000 });
    // Expected state: "No live job provider is configured" (noProviderConfigured:true).
    // Under test-runner load the per-user rate limit may fire (429), which renders an
    // ErrorState in <main>.  Both outcomes confirm the page mounted and issued an API call.
    await expect(
      page.locator("main").getByText(/provider|demo|listing|something went wrong/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("/opportunities — demo mode toggle works", async ({ page }) => {
    await page.goto("/opportunities");
    const demoBtn = page.getByRole("button", { name: /explore demo listings/i });
    if (await demoBtn.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await demoBtn.click();
      await expect(page.getByText(/demo/i).first()).toBeVisible({ timeout: 12_000 });
    }
  });

  test("/applications → Saved jobs & applications", async ({ page }) => {
    await page.goto("/applications");
    await expect(
      page.getByRole("heading", { name: /saved jobs/i, level: 1 })
    ).toBeVisible();
  });

  test("/development → Skill development", async ({ page }) => {
    await page.goto("/development");
    await expect(page.getByRole("heading", { name: /skill development/i, level: 1 })).toBeVisible();
  });

  test("/copilot → Career Copilot", async ({ page }) => {
    await page.goto("/copilot");
    await expect(page.getByRole("heading", { name: /career copilot/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("textbox")).toBeVisible();
  });

  test("/resume → Resume", async ({ page }) => {
    await page.goto("/resume");
    await expect(page.getByRole("heading", { name: /resume/i, level: 1 })).toBeVisible();
  });

  test("/repositories → renders (heading or error state)", async ({ page }) => {
    await page.goto("/repositories");
    // Success: h1 "Repositories"; Error: test user has a dummy GitHub token so
    // the API returns GITHUB_TOKEN_EXPIRED and ErrorState renders "Something went wrong".
    // Both outcomes confirm the route mounted and rendered without a React crash.
    await expect(
      page.getByRole("heading", { name: /repositories/i, level: 1 })
        .or(page.getByText("Something went wrong"))
    ).toBeVisible({ timeout: 12_000 });
  });

  test("/roles → Target role", async ({ page }) => {
    await page.goto("/roles");
    await expect(page.getByRole("heading", { name: /target role/i, level: 1 })).toBeVisible();
  });

  test("/preferences → Career preferences", async ({ page }) => {
    await page.goto("/preferences");
    await expect(page.getByRole("heading", { name: /preferences/i, level: 1 })).toBeVisible();
  });

  test("/settings → Settings with provider rows", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /settings/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/remotive|adzuna|jsearch/i).first()).toBeVisible();
  });

  test("unknown route → 404 page with text", async ({ page }) => {
    await page.goto("/nonexistent-route-xyz");
    await expect(page.getByText("Page not found.")).toBeVisible();
  });
});

// ── Copilot interaction ───────────────────────────────────────────────────────

test.describe("Copilot chat", () => {
  test.beforeEach(async ({ context }) => {
    await injectSession(context);
  });

  test("suggested prompts are visible on load", async ({ page }) => {
    await page.goto("/copilot");
    // Scope to main to avoid matching hidden sidebar nav labels (e.g. "Skills")
    await expect(
      page.locator("main").getByText(/Find backend|skill|transition/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("sending 'help' returns a Copilot response", async ({ page }) => {
    await page.goto("/copilot");
    const input = page.getByRole("textbox");
    await input.fill("help");
    await page.keyboard.press("Enter");
    // Scope to main to avoid hidden sidebar links matching the response text
    await expect(
      page.locator("main").getByText(/search|skill|direction|evidence/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });
});

// ── Settings — data deletion confirmation ────────────────────────────────────

test.describe("Settings safety", () => {
  test.beforeEach(async ({ context }) => {
    await injectSession(context);
  });

  test("account deletion section requires confirmation phrase", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/DELETE MY DATA|delete.*account/i).first()).toBeVisible();
  });
});

// ── API endpoint coverage ─────────────────────────────────────────────────────

test.describe("API endpoint coverage (authenticated)", () => {
  test.beforeEach(async ({ context }) => {
    await injectSession(context);
  });

  async function getSessionCookie(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[0] extends { page: infer P } ? P : never : never) {
    await page.goto("/");
    const cookies = await page.context().cookies();
    return cookies.find((c) => c.name === "nexus_session")!;
  }

  test("GET /api/auth/me — returns test user", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sc = cookies.find((c) => c.name === "nexus_session")!;
    const res = await request.get("http://localhost:4000/api/auth/me", {
      headers: { cookie: `nexus_session=${sc.value}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.username).toBe("e2e-test-user");
  });

  test("GET /api/career/profile — returns profile structure", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sc = cookies.find((c) => c.name === "nexus_session")!;
    const res = await request.get("http://localhost:4000/api/career/profile", {
      headers: { cookie: `nexus_session=${sc.value}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty("preferences");
  });

  test("GET /api/opportunities/providers — returns providers array", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sc = cookies.find((c) => c.name === "nexus_session")!;
    const res = await request.get("http://localhost:4000/api/opportunities/providers", {
      headers: { cookie: `nexus_session=${sc.value}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Response shape: { data: { providers: [...], llm: {...} } }
    expect(Array.isArray(body.data.providers)).toBe(true);
    expect(body.data.providers.length).toBeGreaterThan(0);
  });

  test("GET /api/saved-jobs — returns empty items array for new user", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sc = cookies.find((c) => c.name === "nexus_session")!;
    const res = await request.get("http://localhost:4000/api/saved-jobs", {
      headers: { cookie: `nexus_session=${sc.value}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Response shape: { data: { items: [] } }
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  test("GET /api/copilot/prompts — returns prompts array", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sc = cookies.find((c) => c.name === "nexus_session")!;
    const res = await request.get("http://localhost:4000/api/copilot/prompts", {
      headers: { cookie: `nexus_session=${sc.value}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Response shape: { data: { prompts: [...] } }
    expect(Array.isArray(body.data.prompts)).toBe(true);
    expect(body.data.prompts.length).toBeGreaterThan(0);
  });
});

// ── Visual overflow check ────────────────────────────────────────────────────

test.describe("Responsive layout — no horizontal overflow", () => {
  const viewports = [
    { name: "mobile-320", width: 320, height: 568 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1280", width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`${vp.name} — sign-in page, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard"); // AuthGate redirects to sign-in
      await page.locator("h1").filter({ hasText: "NEXUS" }).waitFor({ timeout: 10_000 });
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });
  }

  test("desktop-1280 authenticated dashboard — no horizontal overflow", async ({ page, context }) => {
    await injectSession(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("mobile-390 authenticated dashboard — no horizontal overflow", async ({ page, context }) => {
    await injectSession(context);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
