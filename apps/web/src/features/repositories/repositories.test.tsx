// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";

function repo(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `r${n}`, githubId: n, owner: "octocat", name: `repo-${n}`, fullName: `octocat/repo-${n}`,
    url: `https://github.com/octocat/repo-${n}`, description: `Description ${n}`, isFork: false, isArchived: false,
    primaryLanguage: "TypeScript", stars: 0, selected: false, analyzed: false, analyzedAt: null, ...overrides,
  };
}

type Repo = ReturnType<typeof repo>;
type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });
const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status });

const quota = { limit: 5000, remaining: 4321, resetAt: "2026-03-01T12:30:00.000Z" };
const overview = { analysis: null, categories: [{ id: "frontend", displayName: "Frontend", skills: [] }] };
const rolesCatalog = { catalogVersion: "1.0.0", roles: [] };

let store: Repo[];
let overrides: Record<string, Handler>;
let calls: Array<{ url: string; method: string; body?: string }>;

// A small in-memory backend: selection and analysis mutate `store` like the real API would.
function defaultHandler(url: string, init?: RequestInit): Response | Promise<Response> {
  const method = init?.method ?? "GET";
  const key = `${method} ${url}`;
  if (overrides[key]) return overrides[key](url, init);

  if (key === "GET /api/auth/me") return ok({ username: "octocat" });
  if (key === "GET /api/github/repos") return ok({ repositories: store, count: store.length, truncated: false });
  if (key === "GET /api/github/quota") return ok(quota);
  if (key === "GET /api/skills") return ok(overview);
  if (key === "GET /api/roles") return ok(rolesCatalog);

  const selection = url.match(/^\/api\/github\/repos\/(r\d+)\/selection$/);
  if (method === "PATCH" && selection) {
    const target = store.find((entry) => entry.id === selection[1])!;
    target.selected = JSON.parse(init!.body as string).selected;
    return ok(target);
  }
  const analyze = url.match(/^\/api\/analysis\/repositories\/(r\d+)$/);
  if (method === "POST" && analyze) {
    const target = store.find((entry) => entry.id === analyze[1])!;
    target.analyzed = true;
    return ok({ repository: { id: target.id } });
  }
  return fail(404, "NOT_FOUND", `unexpected ${key}`);
}

beforeEach(() => {
  store = [repo(1), repo(2, { description: null, primaryLanguage: null, isFork: true, isArchived: true })];
  overrides = {};
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    return defaultHandler(url, init);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openRepositories() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/repositories"]}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByText("octocat/repo-1");
  return user;
}

const count = (method: string, pattern: RegExp) => calls.filter((call) => call.method === method && pattern.test(call.url)).length;

describe("repository list", () => {
  it("renders repositories with description, language, fork/archive and analysis status plus quota", async () => {
    store[0]!.analyzed = true;
    store[0]!.selected = true;
    await openRepositories();

    expect(screen.getByText("Description 1")).toBeTruthy();
    expect(screen.getByText(/TypeScript · Analyzed/)).toBeTruthy();
    expect(screen.getByText(/No primary language · Fork · Archived · Not yet analyzed/)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "octocat/repo-1" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/4321 of 5000 requests remaining/)).toBeTruthy();
    expect(screen.getByText("1 of 15 repositories selected")).toBeTruthy();
  });

  it("is reachable from the navigation and offers Skills and Target role links", async () => {
    await openRepositories();
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });

    expect(within(nav).getByRole("link", { name: "GitHub Evidence" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Skill Intelligence" })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Role & Gap Analysis" })).toBeTruthy();
  });

  it("shows an empty state when there are no public repositories", async () => {
    overrides["GET /api/github/repos"] = () => ok({ repositories: [], count: 0, truncated: false });
    render(<MemoryRouter initialEntries={["/repositories"]}><App /></MemoryRouter>);

    expect(await screen.findByText("No public repositories found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Analyze selected repositories" })).toBeNull();
  });

  it("shows an error with retry, and still works when quota is unavailable", async () => {
    let failing = true;
    overrides["GET /api/github/repos"] = () => (failing ? fail(502, "GITHUB_SERVICE_UNAVAILABLE", "GitHub is down") : ok({ repositories: store, count: 2, truncated: false }));
    overrides["GET /api/github/quota"] = () => fail(502, "GITHUB_SERVICE_UNAVAILABLE", "x");
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/repositories"]}><App /></MemoryRouter>);

    expect(await screen.findByText(/GitHub is down/)).toBeTruthy();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("octocat/repo-1")).toBeTruthy();
    expect(screen.getByText("GitHub API quota unavailable")).toBeTruthy();
  });

  it("refreshes discovery on demand", async () => {
    const user = await openRepositories();
    store.push(repo(3));

    await user.click(screen.getByRole("button", { name: "Refresh repositories" }));

    expect(await screen.findByText("octocat/repo-3")).toBeTruthy();
    expect(count("GET", /^\/api\/github\/repos$/)).toBe(2);
  });
});

describe("selection", () => {
  it("selects and deselects through the selection endpoint with the exact body", async () => {
    const user = await openRepositories();
    const box = screen.getByRole("checkbox", { name: "octocat/repo-1" }) as HTMLInputElement;

    await user.click(box);
    await waitFor(() => expect(box.checked).toBe(true));
    expect(calls.find((call) => call.method === "PATCH")).toMatchObject({
      url: "/api/github/repos/r1/selection",
      body: JSON.stringify({ selected: true }),
    });
    expect(screen.getByText("1 of 15 repositories selected")).toBeTruthy();

    await user.click(box);
    await waitFor(() => expect(box.checked).toBe(false));
    expect(calls.filter((call) => call.method === "PATCH")[1]!.body).toBe(JSON.stringify({ selected: false }));
  });

  it("blocks a 16th selection in the UI", async () => {
    store = Array.from({ length: 16 }, (_, index) => repo(index + 1, { selected: index < 15 }));
    await openRepositories();

    expect(screen.getByText(/15 of 15 repositories selected \(limit reached/)).toBeTruthy();
    const sixteenth = screen.getByRole("checkbox", { name: "octocat/repo-16" }) as HTMLInputElement;
    expect(sixteenth.disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "octocat/repo-1" }) as HTMLInputElement).disabled).toBe(false);
    expect(count("PATCH", /selection/)).toBe(0);
  });

  it("surfaces a backend rejection and leaves the repository unselected", async () => {
    overrides["PATCH /api/github/repos/r1/selection"] = () =>
      fail(400, "INVALID_REPOSITORY_SELECTION", "Cannot select more than 15 repositories.");
    const user = await openRepositories();
    const box = screen.getByRole("checkbox", { name: "octocat/repo-1" }) as HTMLInputElement;

    await user.click(box);

    expect((await screen.findByRole("alert")).textContent).toContain("Cannot select more than 15 repositories.");
    expect(box.checked).toBe(false);
  });
});

describe("analysis", () => {
  it("analyzes only selected, not-yet-analyzed repositories, sequentially, then refreshes", async () => {
    store = [repo(1, { selected: true }), repo(2, { selected: true, analyzed: true }), repo(3), repo(4, { selected: true })];
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    overrides["POST /api/analysis/repositories/r1"] = async () => {
      active++; maxActive = Math.max(maxActive, active); order.push("r1");
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--; store[0]!.analyzed = true;
      return ok({});
    };
    overrides["POST /api/analysis/repositories/r4"] = async () => {
      active++; maxActive = Math.max(maxActive, active); order.push("r4");
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--; store[3]!.analyzed = true;
      return ok({});
    };
    const user = await openRepositories();
    const reposBefore = count("GET", /^\/api\/github\/repos$/);

    await user.click(screen.getByRole("button", { name: "Analyze selected repositories" }));

    await waitFor(() => expect(screen.getAllByText("Analysis succeeded")).toHaveLength(2));
    expect(order).toEqual(["r1", "r4"]);
    expect(maxActive).toBe(1);
    expect(count("POST", /\/api\/analysis\/repositories\//)).toBe(2);
    await waitFor(() => expect(count("GET", /^\/api\/github\/repos$/)).toBe(reposBefore + 1));
    expect(screen.queryByText(/Not yet analyzed/)).not.toBeNull(); // repo-3 was never selected
    expect(screen.getByText("All selected repositories are already analyzed.")).toBeTruthy();
  });

  it("reports an individual failure without claiming success, and continues with the rest", async () => {
    store = [repo(1, { selected: true }), repo(2, { selected: true })];
    overrides["POST /api/analysis/repositories/r1"] = () => fail(429, "GITHUB_RATE_LIMIT", "GitHub rate limit reached.");
    const user = await openRepositories();

    await user.click(screen.getByRole("button", { name: "Analyze selected repositories" }));

    expect(await screen.findByText("Analysis failed: GitHub rate limit reached.")).toBeTruthy();
    expect(await screen.findByText("Analysis succeeded")).toBeTruthy();
    const failedRow = screen.getByText("octocat/repo-1").closest("li")!;
    expect(within(failedRow).getByText(/Not yet analyzed/)).toBeTruthy();
    expect(within(failedRow).queryByText("Analysis succeeded")).toBeNull();
  });

  it("prevents duplicate submissions while a batch runs and locks selection", async () => {
    store = [repo(1, { selected: true })];
    let release!: () => void;
    overrides["POST /api/analysis/repositories/r1"] = () =>
      new Promise<Response>((resolve) => { release = () => { store[0]!.analyzed = true; resolve(ok({})); }; });
    const user = await openRepositories();

    await user.click(screen.getByRole("button", { name: "Analyze selected repositories" }));
    const busy = screen.getByRole("button", { name: "Analyzing..." }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "octocat/repo-1" }) as HTMLInputElement).disabled).toBe(true);
    await user.click(busy);
    expect(screen.getByText("Analyzing...", { selector: "p" })).toBeTruthy();

    release();
    await screen.findByText("Analysis succeeded");
    expect(count("POST", /\/api\/analysis\/repositories\//)).toBe(1);
  });

  it("re-analyzes already analyzed repositories only when asked", async () => {
    store = [repo(1, { selected: true, analyzed: true })];
    const user = await openRepositories();
    expect((screen.getByRole("button", { name: "Analyze selected repositories" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("checkbox", { name: /re-analyze already analyzed/i }));
    await user.click(screen.getByRole("button", { name: "Analyze selected repositories" }));

    await screen.findByText("Analysis succeeded");
    expect(count("POST", /\/api\/analysis\/repositories\/r1/)).toBe(1);
  });

  it("asks the user to select a repository when none is selected", async () => {
    await openRepositories();

    expect(screen.getByText("Select at least one repository to analyze.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Analyze selected repositories" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("scoring", () => {
  it("is disabled until a repository has been analyzed", async () => {
    await openRepositories();

    expect((screen.getByRole("button", { name: "Score collected evidence" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Analyze a repository before scoring.")).toBeTruthy();
  });

  it("scores persisted evidence and links to the Skill Graph and Target Role pages", async () => {
    store = [repo(1, { selected: true, analyzed: true })];
    overrides["POST /api/analysis/run"] = () =>
      ok({ analysisId: "a1", scoringVersion: "1.0.0", repositoryCount: 1, skippedRepositoryCount: 0, evidenceCount: 7, scoredSkillCount: 3 }, 201);
    overrides["GET /api/roles"] = () =>
      ok({ catalogVersion: "1.0.0", roles: [{ id: "ai-engineer", displayName: "AI Engineer", requirements: [] }] });
    const user = await openRepositories();

    await user.click(screen.getByRole("button", { name: "Score collected evidence" }));

    expect(await screen.findByText(/Scored 3 skills from 7 evidence items across 1 repository\./)).toBeTruthy();
    expect(count("POST", /^\/api\/analysis\/run$/)).toBe(1);

    await user.click(screen.getByRole("link", { name: "Choose a Target Role" }));
    expect(await screen.findByRole("radio", { name: "AI Engineer" })).toBeTruthy();
  });

  it("navigates to the Skill Graph after scoring", async () => {
    store = [repo(1, { selected: true, analyzed: true })];
    overrides["POST /api/analysis/run"] = () =>
      ok({ analysisId: "a1", scoringVersion: "1.0.0", repositoryCount: 1, skippedRepositoryCount: 1, evidenceCount: 1, scoredSkillCount: 1 }, 201);
    const user = await openRepositories();
    await user.click(screen.getByRole("button", { name: "Score collected evidence" }));
    expect(await screen.findByText(/1 analyzed repository was skipped/)).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "View Skill Graph" }));

    expect(await screen.findByRole("heading", { name: "Skill Intelligence" })).toBeTruthy();
  });

  it("explains NO_EVIDENCE and sends no duplicate requests while scoring", async () => {
    store = [repo(1, { selected: true, analyzed: true })];
    overrides["POST /api/analysis/run"] = () => fail(404, "NO_EVIDENCE", "No evidence is available to score.");
    const user = await openRepositories();

    await user.click(screen.getByRole("button", { name: "Score collected evidence" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Select and analyze at least one repository first.");
    expect(count("POST", /^\/api\/analysis\/run$/)).toBe(1);
  });

  it("reports other scoring failures", async () => {
    store = [repo(1, { selected: true, analyzed: true })];
    overrides["POST /api/analysis/run"] = () => fail(500, "INVALID_EVIDENCE", "Stored evidence is invalid.");
    const user = await openRepositories();

    await user.click(screen.getByRole("button", { name: "Score collected evidence" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Stored evidence is invalid.");
  });
});
