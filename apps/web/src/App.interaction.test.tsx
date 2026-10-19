// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// Drives the real <App/> (router, pages, hooks, API client) against a stubbed
// network. Every number shown must come from these canned backend responses.

const analysis = { analysisId: "a1", scoringVersion: "1.0.0", createdAt: "2026-03-01T00:00:00.000Z", repositoryCount: 2, evidenceCount: 4 };

const overview = {
  analysis,
  categories: [
    {
      id: "frontend",
      displayName: "Frontend",
      skills: [
        { id: "react", displayName: "React", categoryId: "frontend", score: 36.5, status: "scored", repositoryCount: 1 },
        { id: "nextjs", displayName: "Next.js", categoryId: "frontend", score: null, status: "no-evidence", repositoryCount: 0 },
      ],
    },
  ],
};

const reactDetail = {
  skill: { id: "react", displayName: "React", categoryId: "frontend", categoryName: "Frontend" },
  analysis,
  status: "scored",
  score: 36.5,
  contributionWeightSum: 0.9,
  contributions: [
    {
      rank: 1,
      repository: { id: "r1", fullName: "octocat/app", url: "https://github.com/octocat/app" },
      repositorySkillScore: 40,
      baseScore: 80,
      breadthFactor: 0.5,
      meaningfulSignalCount: 1,
      applicableWeightSum: 0.2,
      repositorySubstance: 0.9,
      rankMultiplier: 1,
      contributionWeight: 0.9,
      signals: [{ signal: "dependency", weight: 0.2, applicable: true, strength: 1, meaningful: true, evidenceCount: 1, evidenceIds: [] }],
    },
  ],
  excludedRepositories: [],
};

const reactEvidence = {
  skillId: "react",
  evidence: [
    {
      repositoryId: "r1", skillId: "react", evidenceType: "DEPENDENCY", signal: "dependency", value: "react",
      normalizedStrength: 1, sourcePath: "package.json", explanation: "react is declared in package.json",
      detectedAt: "2026-03-01T00:00:00.000Z",
    },
  ],
};

const nextDetail = {
  ...reactDetail,
  skill: { id: "nextjs", displayName: "Next.js", categoryId: "frontend", categoryName: "Frontend" },
  status: "no-evidence", score: null, contributionWeightSum: null, contributions: [],
};

const roles = {
  catalogVersion: "1.0.0",
  roles: ["Software Engineer", "Full-Stack Developer", "Backend Engineer", "AI Engineer", "ML Engineer"].map((displayName, index) => ({
    id: ["software-engineer", "full-stack-developer", "backend-engineer", "ai-engineer", "ml-engineer"][index]!,
    displayName,
    requirements: [
      { skillId: "python", skillName: "Python", weight: 0.6, minimumScore: 60 },
      { skillId: "docker", skillName: "Docker", weight: 0.4, minimumScore: 40 },
    ],
  })),
};

function gapResult(roleId: string, roleName: string, roleMatch: number) {
  const python = { skillId: "python", skillName: "Python", evidenceScore: 42, evidenceAvailable: true, weight: 0.6, minimumScore: 60, weightedContribution: 25.2, gap: -18, deficit: 18, criticalGap: true };
  const docker = { skillId: "docker", skillName: "Docker", evidenceScore: 40, evidenceAvailable: true, weight: 0.4, minimumScore: 40, weightedContribution: 16, gap: 0, deficit: 0, criticalGap: false };

  return { id: `g-${roleId}`, analysisId: "a1", scoringVersion: "1.0.0", roleCatalogVersion: "1.0.0", createdAt: "2026-03-02T00:00:00.000Z", roleId, roleName, roleMatch, requirements: [python, docker], criticalGaps: [python] };
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });
const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status });

let handler: Handler;
let calls: Array<{ url: string; method: string; body?: string }>;

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    return handler(url, init);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function baseHandler(overrides: Record<string, Handler> = {}): Handler {
  const routes: Record<string, Handler> = {
    "/api/auth/me": () => ok({ username: "octocat" }),
    "/api/skills": () => ok(overview),
    "/api/skills/react": () => ok(reactDetail),
    "/api/skills/react/evidence": () => ok(reactEvidence),
    "/api/skills/nextjs": () => ok(nextDetail),
    "/api/skills/nextjs/evidence": () => ok({ skillId: "nextjs", evidence: [] }),
    "/api/roles": () => ok(roles),
    ...overrides,
  };

  return (url, init) => {
    const route = routes[url];
    return route ? route(url, init) : fail(404, "NOT_FOUND", `unexpected ${url}`);
  };
}

describe("skill overview and detail (real App, stubbed network)", () => {
  it("renders API data and opens a skill's detail with contributions and evidence", async () => {
    handler = baseHandler();
    const user = userEvent.setup();
    mount();

    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByText("36.5/100")).toBeTruthy();
    expect(screen.getByText("Next.js")).toBeTruthy();
    expect(screen.getByText("No evidence available")).toBeTruthy();

    await user.click(screen.getByRole("link", { name: /React/ }));

    expect(await screen.findByRole("heading", { name: "React" })).toBeTruthy();
    expect(await screen.findByText("octocat/app")).toBeTruthy();
    expect(screen.getByText("Rank 1")).toBeTruthy();
    expect(screen.getByText("react is declared in package.json")).toBeTruthy();
    expect(screen.getByText("package.json")).toBeTruthy();
    expect(screen.getByText("36.5/100")).toBeTruthy();
    expect(calls.map((call) => call.url)).toEqual(expect.arrayContaining(["/api/skills/react", "/api/skills/react/evidence"]));

    await user.click(screen.getByRole("link", { name: "Back to skill overview" }));
    expect(await screen.findByRole("heading", { name: "Skill graph" })).toBeTruthy();
  });

  it("shows the no-evidence state for a skill without a score", async () => {
    handler = baseHandler();
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole("link", { name: /Next\.js/ }));

    expect(await screen.findByText(/does not show you lack the skill/)).toBeTruthy();
    expect(screen.queryByText(/\/100/)).toBeNull();
  });

  it("shows an error and recovers on retry", async () => {
    let failing = true;
    handler = baseHandler({ "/api/skills": () => (failing ? fail(500, "INTERNAL_ERROR", "boom") : ok(overview)) });
    const user = userEvent.setup();
    mount();

    expect(await screen.findByRole("alert")).toBeTruthy();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("36.5/100")).toBeTruthy();
  });

  it("shows the sign-in prompt for an unauthenticated session", async () => {
    handler = baseHandler({ "/api/auth/me": () => fail(401, "UNAUTHORIZED", "Authentication required.") });
    mount();

    expect(await screen.findByRole("link", { name: "Sign in with GitHub" })).toBeTruthy();
    expect(calls.some((call) => call.url === "/api/skills")).toBe(false);
  });

  it("shows Not yet analyzed and never a score before any analysis exists", async () => {
    const empty = { analysis: null, categories: [{ ...overview.categories[0]!, skills: overview.categories[0]!.skills.map((skill) => ({ ...skill, score: null, status: "not-analyzed" })) }] };
    handler = baseHandler({ "/api/skills": () => ok(empty) });
    mount();

    expect((await screen.findAllByText("Not yet analyzed")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\/100/)).toBeNull();
  });
});

describe("role selection and gap analysis (real App, stubbed network)", () => {
  async function openRoles() {
    const user = userEvent.setup();
    mount("/roles");
    await screen.findByText("Select one role");
    return user;
  }

  it("offers five roles, runs gap analysis for the selected role and shows backend values verbatim", async () => {
    handler = baseHandler({ "/api/gap-analysis": () => ok(gapResult("ai-engineer", "AI Engineer", 61.234), 201) });
    const user = await openRoles();

    expect(screen.getAllByRole("radio")).toHaveLength(5);
    await user.click(screen.getByRole("radio", { name: "AI Engineer" }));
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));

    expect(await screen.findByText("AI Engineer: Role Match")).toBeTruthy();
    const post = calls.find((call) => call.method === "POST");
    expect(post).toMatchObject({ url: "/api/gap-analysis", body: JSON.stringify({ roleId: "ai-engineer" }) });
    // 61.234 comes straight from the backend; 0.6*42 + 0.4*40 would be 41.2.
    expect(screen.getByText("61.2")).toBeTruthy();
  });

  it("renders critical gaps, and treats a score equal to its minimum as met", async () => {
    handler = baseHandler({ "/api/gap-analysis": () => ok(gapResult("ai-engineer", "AI Engineer", 41.2), 201) });
    const user = await openRoles();
    await user.click(screen.getByRole("radio", { name: "AI Engineer" }));
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));

    const critical = await screen.findByRole("heading", { name: "Critical gaps (1)" });
    const section = critical.closest("section")!;
    expect(within(section).getByText("Python")).toBeTruthy();
    expect(within(section).getByText("Status: Critical Gap")).toBeTruthy();
    expect(within(section).getByText("−18.0")).toBeTruthy();
    expect(within(section).queryByText("Docker")).toBeNull();

    const table = screen.getByRole("table", { name: /Requirement-by-requirement/ });
    const dockerRow = within(table).getByText("Docker").closest("tr")!;
    expect(within(dockerRow).getByText("Threshold met")).toBeTruthy();
  });

  it("cannot display a stale result after switching roles", async () => {
    let releaseFirst!: () => void;
    handler = baseHandler({
      "/api/gap-analysis": (_url, init) => {
        const roleId = JSON.parse(init!.body as string).roleId as string;
        if (roleId === "ai-engineer") {
          return new Promise<Response>((resolve) => {
            releaseFirst = () => resolve(ok(gapResult("ai-engineer", "AI Engineer", 11.1), 201));
          });
        }
        return ok(gapResult("ml-engineer", "ML Engineer", 22.2), 201);
      },
    });
    const user = await openRoles();

    await user.click(screen.getByRole("radio", { name: "AI Engineer" }));
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));
    await user.click(screen.getByRole("radio", { name: "ML Engineer" }));
    releaseFirst();
    await waitFor(() => expect(calls.filter((call) => call.method === "POST")).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByText("AI Engineer: Role Match")).toBeNull();
    expect(screen.queryByText("11.1")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));
    expect(await screen.findByText("ML Engineer: Role Match")).toBeTruthy();
    expect(screen.queryByText("AI Engineer: Role Match")).toBeNull();
  });

  it("clears the previous result when another role is selected", async () => {
    handler = baseHandler({ "/api/gap-analysis": () => ok(gapResult("ai-engineer", "AI Engineer", 61.2), 201) });
    const user = await openRoles();
    await user.click(screen.getByRole("radio", { name: "AI Engineer" }));
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));
    await screen.findByText("AI Engineer: Role Match");

    await user.click(screen.getByRole("radio", { name: "Backend Engineer" }));

    expect(screen.queryByText("AI Engineer: Role Match")).toBeNull();
  });

  it("sends one request for repeated clicks while a run is in flight", async () => {
    let release!: () => void;
    handler = baseHandler({
      "/api/gap-analysis": () => new Promise<Response>((resolve) => { release = () => resolve(ok(gapResult("ai-engineer", "AI Engineer", 5), 201)); }),
    });
    const user = await openRoles();
    await user.click(screen.getByRole("radio", { name: "AI Engineer" }));
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));
    const running = screen.getByRole("button", { name: "Running..." }) as HTMLButtonElement;

    expect(running.disabled).toBe(true);
    await user.click(running);
    release();
    await screen.findByText("AI Engineer: Role Match");

    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("explains a missing analysis and reports other failures", async () => {
    let code = "NO_ANALYSIS";
    handler = baseHandler({ "/api/gap-analysis": () => fail(code === "NO_ANALYSIS" ? 404 : 500, code, "x") });
    const user = await openRoles();
    await user.click(screen.getByRole("radio", { name: "AI Engineer" }));
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));

    expect(await screen.findByText("Not yet analyzed")).toBeTruthy();
    expect(screen.queryByText(/\/100/)).toBeNull();

    code = "INTERNAL_ERROR";
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("shows loading then an error with retry when roles fail to load", async () => {
    let failing = true;
    handler = baseHandler({ "/api/roles": () => (failing ? fail(500, "INTERNAL_ERROR", "roles down") : ok(roles)) });
    const user = userEvent.setup();
    mount("/roles");

    expect(await screen.findByText(/roles down/)).toBeTruthy();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Select one role")).toBeTruthy();
  });
});
