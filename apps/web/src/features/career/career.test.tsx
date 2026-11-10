// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { validateResumeFile } from "./ResumePage";
import { buildSearchPath, EMPTY_FILTERS } from "./OpportunitiesPage";

// Drives the real <App/> against a stubbed network. Everything shown comes
// from these canned API responses.

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });
const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message } }), { status });

const job = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  provider: "demo",
  isDemo: true,
  title: "Backend Engineering Intern",
  company: "Example Labs (demo)",
  description: "Build REST APIs with Node.js.\nNice to have: Docker.",
  location: "Bengaluru, India",
  workMode: "hybrid",
  employmentType: "internship",
  requiredSkills: ["nodejs", "postgresql"],
  preferredSkills: ["docker"],
  url: "https://example.com/demo-jobs/backend-intern",
  sourceName: "Demo fixture (not a real vacancy)",
  retrievedAt: "2026-10-20T00:00:00.000Z",
  stale: false,
  ...overrides,
});

const match = (jobId: string, overrides: Record<string, unknown> = {}) => ({
  jobId,
  matchingVersion: "1.0.0",
  score: 78,
  label: "strong",
  confidence: "medium",
  components: [{ key: "requiredSkills", weight: 0.35, value: 0.5, note: "1 supported by GitHub evidence." }],
  skills: [
    { skill: "nodejs", requirement: "required", status: "github", githubScore: 80, projects: [{ fullName: "octocat/api", url: "https://github.com/octocat/api" }] },
    { skill: "postgresql", requirement: "required", status: "missing", githubScore: null, projects: [] },
  ],
  preferenceMatches: { matched: ["Work mode"], mismatched: [], unknown: ["Salary"] },
  hardBlockers: [],
  unresolvedEligibility: [],
  unavailableInformation: ["Salary or stipend not provided."],
  explanation: ["Score 78/100 is a weighted similarity. It is not a hiring probability."],
  ...overrides,
});

const evidence = { hasGithubAnalysis: true, githubAnalyzedAt: "2026-10-18T10:00:00.000Z", hasResume: false, resumeVersion: null };

const search = (items: unknown[], overrides: Record<string, unknown> = {}) => ({
  mode: "demo",
  noProviderConfigured: false,
  providers: [{ id: "demo", label: "Demo fixtures", configured: true, ok: true, count: items.length }],
  retrievedAt: "2026-10-20T00:00:00.000Z",
  profile: evidence,
  items,
  dismissedCount: 0,
  ...overrides,
});

const careerProfile = (overrides: Record<string, unknown> = {}) => ({
  preferences: { directions: [], employmentTypes: [], workModes: [], locations: [] },
  resume: null,
  learning: { direction: null, tasks: {} },
  refresh: { status: "idle", lastAttemptAt: null, lastSuccessAt: null, lastError: null },
  evidence,
  directions: [{ id: "backend-engineer", displayName: "Backend Engineer" }, { id: "ml-engineer", displayName: "ML Engineer" }],
  llmConfigured: false,
  ...overrides,
});

const plan = (overrides: Record<string, unknown> = {}) => ({
  direction: { id: "backend-engineer", displayName: "Backend Engineer" },
  baseline: { source: "role-catalog", version: "1.0.0" },
  demand: { source: "demo", sampleSize: 4, note: "Demo fixtures: illustrative only." },
  gaps: [
    {
      skillId: "postgresql", skillName: "PostgreSQL", status: "missing", githubScore: null, minimumScore: 50, baselineWeight: 0.3, demandCount: 2, priority: 0.7,
      prerequisites: [{ skillId: "sql", skillName: "SQL", status: "missing" }], whyItMatters: "30% of the Backend Engineer benchmark.",
      task: { learn: "Learn PostgreSQL.", milestone: "Back an API with PostgreSQL.", verification: "Repository with migrations.", effortHours: [10, 20] }, taskStatus: null,
    },
  ],
  alreadyDemonstrated: [{ skillId: "nodejs", skillName: "Node.js", githubScore: 80 }],
  nextAction: "Start with PostgreSQL: Back an API with PostgreSQL.",
  caveats: ["A completed task does not by itself verify a skill."],
  ...overrides,
});

let handler: Handler;
let calls: Array<{ url: string; method: string; body?: unknown }>;

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body });
    return handler(url, init);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function routes(overrides: Record<string, Handler> = {}): Handler {
  const base: Record<string, Handler> = {
    "/api/auth/me": () => ok({ username: "octocat" }),
    "/api/career/profile": () => ok(careerProfile()),
    "/api/copilot/prompts": () => ok({ prompts: ["Show me remote internships"] }),
    ...overrides,
  };
  return (url, init) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const route = base[key] ?? base[url] ?? base[url.split("?")[0]!];
    return route ? route(url, init) : fail(404, "NOT_FOUND", `unexpected ${key}`);
  };
}

describe("shell and sign-in", () => {
  it("adds the career navigation while keeping the existing links and account menu", async () => {
    handler = routes({ "/api/opportunities": () => ok(search([])) });
    mount("/opportunities");
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    for (const name of ["Overview", "Job Discovery", "Career Copilot", "Applications", "My Career Profile", "Role & Gap Analysis", "GitHub Evidence", "Skill Intelligence"]) {
      expect(within(nav).getByRole("link", { name })).toBeTruthy();
    }
    expect(await screen.findByRole("button", { name: /octocat/ })).toBeTruthy();
  });

  it("shows the sign-in prompt and makes no career API call when signed out", async () => {
    handler = routes({ "/api/auth/me": () => fail(401, "UNAUTHORIZED", "Authentication required.") });
    mount("/opportunities");
    expect((await screen.findAllByRole("link", { name: "Sign in with GitHub" })).length).toBeGreaterThan(0);
    expect(calls.some((call) => call.url.startsWith("/api/opportunities"))).toBe(false);
  });
});

describe("Opportunities", () => {
  it("builds a bounded query string from the filters", () => {
    expect(buildSearchPath({ ...EMPTY_FILTERS, keywords: " node ", workMode: "remote" })).toBe("/api/opportunities?source=live&limit=30&keywords=node&workMode=remote");
  });

  it("explains that no provider is configured, lists how to enable one, and offers labelled demo data", async () => {
    handler = routes({
      "/api/opportunities": (url) =>
        url.includes("source=demo")
          ? ok(search([{ job: job("demo:a"), match: match("demo:a"), saved: null }]))
          : ok(search([], { mode: "live", noProviderConfigured: true, providers: [{ id: "adzuna", label: "Adzuna", configured: false, hint: "Set ADZUNA_APP_ID and ADZUNA_APP_KEY.", ok: false, count: 0 }] })),
    });
    const user = userEvent.setup();
    mount("/opportunities");

    expect(await screen.findByText("No live job provider is configured")).toBeTruthy();
    expect(screen.getByText(/ADZUNA_APP_ID/)).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Explore demo listings" }));
    expect(await screen.findByText(/Demo mode/)).toBeTruthy();
    expect(screen.getByText(/invented example listings/)).toBeTruthy();
    expect(screen.getByText("Demo example — not a real vacancy")).toBeTruthy();
  });

  it("renders ranked cards with the match label, safe external link and stale warning", async () => {
    handler = routes({
      "/api/opportunities": () =>
        ok(search([{ job: job("demo:a", { stale: true }), match: match("demo:a"), saved: null }, { job: job("demo:b", { title: "Unscorable", isDemo: false, sourceName: "Remotive", url: "https://remotive.com/1" }), match: match("demo:b", { score: null, label: "insufficient-evidence" }), saved: null }], { mode: "live", providers: [{ id: "remotive", label: "Remotive", configured: true, ok: true, count: 2 }] })),
    });
    mount("/opportunities");

    expect(await screen.findByText("Strong match · 78/100")).toBeTruthy();
    expect(screen.getByText("Not enough evidence to score")).toBeTruthy();
    expect(screen.getByText(/Older listing/)).toBeTruthy();
    expect(screen.getByText("Source: Remotive")).toBeTruthy();
    const link = screen.getAllByRole("link", { name: /Open original listing/ })[0]!;
    expect(link.getAttribute("href")).toBe("https://remotive.com/1");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText(/cannot confirm a listing is still open/)).toBeTruthy();
  });

  it("shows partial provider failures, empty results and API errors with retry", async () => {
    let mode: "partial" | "empty" | "error" = "partial";
    handler = routes({
      "/api/opportunities": () =>
        mode === "error"
          ? fail(500, "INTERNAL_ERROR", "boom")
          : ok(search(mode === "partial" ? [{ job: job("demo:a"), match: match("demo:a"), saved: null }] : [], { mode: "live", providers: [{ id: "adzuna", label: "Adzuna", configured: true, ok: false, count: 0, errorKind: "rate_limited", errorMessage: "The job provider rate limit was reached." }] })),
    });
    const user = userEvent.setup();
    mount("/opportunities");
    expect(await screen.findByText(/Some sources failed/)).toBeTruthy();

    mode = "empty";
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("No opportunities match these filters")).toBeTruthy();

    mode = "error";
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    mode = "partial";
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Strong match · 78/100")).toBeTruthy();
  });

  it("sends the chosen filters to the API", async () => {
    handler = routes({ "/api/opportunities": () => ok(search([])) });
    const user = userEvent.setup();
    mount("/opportunities");
    await screen.findByText("No opportunities match these filters");

    await user.type(screen.getByLabelText(/Title, keyword/), "backend");
    await user.selectOptions(screen.getByLabelText("Work mode"), "remote");
    await user.selectOptions(screen.getByLabelText("Employment type"), "internship");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(calls.at(-1)!.url).toContain("keywords=backend"));
    expect(calls.at(-1)!.url).toContain("workMode=remote");
    expect(calls.at(-1)!.url).toContain("employmentType=internship");
  });

  it("opens job details with the explanation, missing skills, project links and unavailable data", async () => {
    handler = routes({ "/api/opportunities": () => ok(search([{ job: job("demo:a"), match: match("demo:a"), saved: null }])) });
    const user = userEvent.setup();
    mount("/opportunities");

    await user.click(await screen.findByRole("button", { name: /View details/ }));
    const panel = screen.getByRole("complementary", { name: "Job details" });
    expect(within(panel).getByText(/not a hiring probability/)).toBeTruthy();
    expect(within(panel).getByText(/Missing or unverified/)).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "octocat/api" }).getAttribute("href")).toBe("https://github.com/octocat/api");
    expect(within(panel).getByText("Salary or stipend not provided.")).toBeTruthy();
    expect(within(panel).getByText(/Build REST APIs/)).toBeTruthy();
  });

  it("surfaces hard eligibility blockers instead of hiding them", async () => {
    handler = routes({
      "/api/opportunities": () =>
        ok(search([{ job: job("demo:a"), match: match("demo:a", { label: "blocked", hardBlockers: ["The listing is limited to students."] }), saved: null }])),
    });
    mount("/opportunities");
    expect(await screen.findByText("Eligibility blocker · 78/100")).toBeTruthy();
    expect(screen.getByText(/Blocker: The listing is limited to students/)).toBeTruthy();
  });

  it("saves, tracks, unsaves and dismisses through the API", async () => {
    const saved = { jobId: "demo:a", job: job("demo:a"), status: "saved", dismissed: false, note: "", statusDate: null, updatedAt: "2026-10-20T00:00:00.000Z" };
    handler = routes({
      "/api/opportunities": () => ok(search([{ job: job("demo:a"), match: match("demo:a"), saved: null }, { job: job("demo:b", { title: "Other role" }), match: match("demo:b"), saved: null }])),
      "PUT /api/saved-jobs/demo%3Aa": (_url, init) => ok({ ...saved, ...JSON.parse(init!.body as string) }, 201),
      "DELETE /api/saved-jobs/demo%3Aa": () => ok({ deleted: true }),
      "PUT /api/saved-jobs/demo%3Ab": () => ok({ ...saved, jobId: "demo:b", dismissed: true }),
    });
    const user = userEvent.setup();
    mount("/opportunities");

    await user.click(await screen.findByRole("button", { name: /^Save Backend Engineering Intern/ }));
    expect(await screen.findByRole("button", { name: /^Unsave/ })).toBeTruthy();
    expect(calls.find((call) => call.method === "PUT")!.body).toBe(JSON.stringify({ status: "saved" }));

    // Tracking form appears for saved jobs and sends status + note.
    await user.click(screen.getAllByRole("button", { name: /View details/ })[0]!);
    await user.selectOptions(screen.getByLabelText("Status"), "applied");
    await user.type(screen.getByLabelText(/Private note/), "Applied via portal");
    await user.click(screen.getByRole("button", { name: "Save tracking" }));
    await waitFor(() => expect(JSON.parse(calls.filter((call) => call.method === "PUT").at(-1)!.body as string)).toMatchObject({ status: "applied", note: "Applied via portal" }));
    // One <option> plus the card badge once the saved status is reflected.
    await waitFor(() => expect(screen.getAllByText("Applied").length).toBeGreaterThan(1));
    expect(screen.getByText(/never applies for you/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Unsave/ }));
    await waitFor(() => expect(calls.some((call) => call.method === "DELETE")).toBe(true));

    await user.click(screen.getByRole("button", { name: /Not interested in Other role/ }));
    await waitFor(() => expect(screen.queryByText("Other role")).toBeNull());
  });
});

describe("Applications", () => {
  it("lists saved jobs, updates status and removes them", async () => {
    const record = { jobId: "demo:a", job: job("demo:a"), status: "saved", dismissed: false, note: "", statusDate: null, updatedAt: "2026-10-20T00:00:00.000Z" };
    handler = routes({
      "/api/saved-jobs": () => ok({ items: [record] }),
      "PUT /api/saved-jobs/demo%3Aa": (_url, init) => ok({ ...record, ...JSON.parse(init!.body as string) }),
      "DELETE /api/saved-jobs/demo%3Aa": () => ok({ deleted: true }),
    });
    const user = userEvent.setup();
    mount("/applications");

    expect(await screen.findByRole("heading", { name: "Backend Engineering Intern" })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Status"), "interviewing");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(JSON.parse(calls.find((call) => call.method === "PUT")!.body as string).status).toBe("interviewing"));

    await user.click(screen.getByRole("button", { name: /Remove/ }));
    expect(await screen.findByText("Nothing saved yet")).toBeTruthy();
  });

  it("shows an empty state that points to Opportunities", async () => {
    handler = routes({ "/api/saved-jobs": () => ok({ items: [] }) });
    mount("/applications");
    expect(await screen.findByText("Nothing saved yet")).toBeTruthy();
  });
});

describe("Resume", () => {
  it("validates files on the client", () => {
    const file = (name: string, size: number) => new File([new Uint8Array(size)], name);
    expect(validateResumeFile(file("cv.exe", 10), 1000)).toMatch(/PDF and DOCX/);
    expect(validateResumeFile(file("cv.pdf", 0), 1000)).toMatch(/empty/);
    expect(validateResumeFile(file("cv.pdf", 2000), 1000)).toMatch(/larger/);
    expect(validateResumeFile(file("cv.docx", 10), 1000)).toBeNull();
  });

  const draft = {
    fileName: "resume.docx",
    fileType: "docx",
    profile: {
      name: "Asha Verma", email: "asha@example.com", links: [], education: [{ degree: "B.Tech", institution: "Example Institute", endYear: 2026 }],
      experience: [{ title: "Backend Intern", isInternship: true }], projects: [{ name: "Campus Marketplace" }],
      skills: [{ name: "Python", source: "resume" }, { name: "Docker", source: "resume" }], certifications: [],
    },
  };

  it("shows the empty state, rejects bad files and walks through upload, review and confirmation", async () => {
    let stored: unknown = null;
    handler = routes({
      "/api/resume": () => ok({ resume: stored, maxBytes: 5_000_000 }),
      "POST /api/resume/extract": () => ok(draft),
      "PUT /api/resume": (_url, init) => {
        const body = JSON.parse(init!.body as string);
        stored = { profile: body.profile, version: 1, fileName: body.fileName, fileType: body.fileType, savedAt: "2026-10-20T00:00:00.000Z" };
        return ok(stored);
      },
    });
    const user = userEvent.setup({ applyAccept: false });
    mount("/resume");

    expect(await screen.findByText("No resume yet")).toBeTruthy();
    const input = screen.getByLabelText(/Upload a resume/) as HTMLInputElement;

    await user.upload(input, new File(["x"], "resume.exe"));
    expect(await screen.findByText(/Only PDF and DOCX/)).toBeTruthy();
    expect(calls.some((call) => call.url === "/api/resume/extract")).toBe(false);

    await user.upload(input, new File(["docx-bytes"], "resume.docx"));
    expect(await screen.findByRole("region", { name: "Review extracted resume" })).toBeTruthy();
    expect(screen.getByDisplayValue("Asha Verma")).toBeTruthy();
    const upload = calls.find((call) => call.url === "/api/resume/extract")!;
    expect(upload.method).toBe("POST");

    await user.click(screen.getByRole("checkbox", { name: /Confirmed Python/ }));
    await user.click(screen.getByRole("button", { name: /Remove Docker/ }));
    await user.type(screen.getByLabelText("Add a skill"), "Go");
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.click(screen.getByRole("button", { name: "Confirm and save" }));

    expect(await screen.findByText("Resume saved. Job matches now use it.")).toBeTruthy();
    const put = JSON.parse(calls.find((call) => call.method === "PUT")!.body as string);
    expect(put.profile.skills).toEqual([{ name: "Python", source: "user-confirmed" }, { name: "Go", source: "user-corrected" }]);
    expect(await screen.findByRole("region", { name: "Active resume" })).toBeTruthy();
  });

  it("cancelling a replacement keeps the active resume", async () => {
    const active = { profile: { ...draft.profile, skills: [{ name: "Rust", source: "user-confirmed" }] }, version: 3, fileName: "old.pdf", fileType: "pdf", savedAt: "2026-10-01T00:00:00.000Z" };
    handler = routes({ "/api/resume": () => ok({ resume: active, maxBytes: 5_000_000 }), "POST /api/resume/extract": () => ok(draft) });
    const user = userEvent.setup({ applyAccept: false });
    mount("/resume");

    expect(await screen.findByText("Active resume (version 3)")).toBeTruthy();
    await user.upload(screen.getByLabelText(/Upload a new resume to replace/), new File(["x"], "new.docx"));
    expect(await screen.findByText(/Your current resume stays active until you save/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText(/Your active resume was not changed/)).toBeTruthy();
    expect(screen.getByText("Active resume (version 3)")).toBeTruthy();
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("reports an unreadable document and keeps the previous resume", async () => {
    const active = { profile: draft.profile, version: 1, fileName: "old.pdf", fileType: "pdf", savedAt: "2026-10-01T00:00:00.000Z" };
    handler = routes({ "/api/resume": () => ok({ resume: active, maxBytes: 5_000_000 }), "POST /api/resume/extract": () => fail(422, "RESUME_UNREADABLE", "No readable text was found. Scanned or image-only documents are not supported.") });
    const user = userEvent.setup({ applyAccept: false });
    mount("/resume");

    await user.upload(await screen.findByLabelText(/Upload a new resume/), new File(["x"], "scan.pdf"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Scanned or image-only/);
    expect(screen.getByText("Active resume (version 1)")).toBeTruthy();
  });

  it("requires explicit confirmation before deleting and says what is kept", async () => {
    const active = { profile: draft.profile, version: 1, fileName: "old.pdf", fileType: "pdf", savedAt: "2026-10-01T00:00:00.000Z" };
    handler = routes({ "/api/resume": () => ok({ resume: active, maxBytes: 5_000_000 }), "DELETE /api/resume": () => ok({ deleted: true }) });
    const user = userEvent.setup();
    mount("/resume");

    await user.click(await screen.findByRole("button", { name: /Delete resume/ }));
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);

    await user.click(screen.getByRole("button", { name: /Delete resume/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete resume" }));
    expect(await screen.findByText(/GitHub evidence, saved jobs, preferences and learning progress were not affected/)).toBeTruthy();
    expect(screen.getByText("No resume yet")).toBeTruthy();
  });
});

describe("Skill development", () => {
  it("shows the empty state until a direction is chosen, then a prioritized plan with honest caveats", async () => {
    handler = routes({
      "/api/career/transition": () => ok(plan()),
      "PUT /api/career/direction": () => ok({ directionId: "backend-engineer" }),
    });
    const user = userEvent.setup();
    mount("/development");

    expect(await screen.findByText("Choose a direction to see your plan")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Career direction"), "backend-engineer");
    expect(await screen.findByText(/Previewing only/)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "1. PostgreSQL" })).toBeTruthy();
    expect(screen.getByText(/Missing — no supporting evidence found/)).toBeTruthy();
    expect(screen.getByText(/Prerequisites not yet demonstrated: SQL/)).toBeTruthy();
    expect(screen.getByText(/Demo fixtures: illustrative only/)).toBeTruthy();
    expect(screen.getByText("Rough effort:")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Set as my direction" }));
    await waitFor(() => expect(calls.some((call) => call.method === "PUT" && call.url === "/api/career/direction")).toBe(true));
  });

  it("persists task status changes and warns that completion is not verification", async () => {
    let status: string | null = null;
    handler = routes({
      "/api/career/profile": () => ok(careerProfile({ learning: { direction: "backend-engineer", tasks: {} } })),
      "/api/career/transition": () => {
        const p = plan();
        (p.gaps[0] as { taskStatus: string | null }).taskStatus = status;
        return ok(p);
      },
      "PUT /api/career/tasks/postgresql": (_url, init) => {
        status = JSON.parse(init!.body as string).status;
        return ok({ skillId: "postgresql", status });
      },
    });
    const user = userEvent.setup();
    mount("/development");

    await user.selectOptions(await screen.findByLabelText("Task status for PostgreSQL"), "completed");
    expect(await screen.findByText(/does not verify the skill/)).toBeTruthy();
    expect(JSON.parse(calls.find((call) => call.url === "/api/career/tasks/postgresql")!.body as string)).toEqual({ status: "completed" });
  });

  it("allows selecting Not started at any time, including when transitioning back from other statuses", async () => {
    let status: string | null = "in_progress";
    handler = routes({
      "/api/career/profile": () => ok(careerProfile({ learning: { direction: "backend-engineer", tasks: { postgresql: { status: "in_progress", updatedAt: "2026-11-09T00:00:00.000Z" } } } })),
      "/api/career/transition": () => {
        const p = plan();
        (p.gaps[0] as { taskStatus: string | null }).taskStatus = status;
        return ok(p);
      },
      "PUT /api/career/tasks/postgresql": (_url, init) => {
        status = JSON.parse(init!.body as string).status;
        return ok({ skillId: "postgresql", status });
      },
    });
    const user = userEvent.setup();
    mount("/development");

    // Gap starts as in_progress — select should display that
    const select = await screen.findByLabelText("Task status for PostgreSQL");
    expect((select as HTMLSelectElement).value).toBe("in_progress");

    // User selects Not started — this was broken before the fix
    await user.selectOptions(select, "not_started");
    await waitFor(() => {
      const taskCall = calls.find((call) => call.url === "/api/career/tasks/postgresql");
      expect(taskCall).toBeTruthy();
      expect(JSON.parse(taskCall!.body as string)).toEqual({ status: "not_started" });
    });
  });

  it("renders all five status options in the task dropdown", async () => {
    handler = routes({
      "/api/career/profile": () => ok(careerProfile({ learning: { direction: "backend-engineer", tasks: {} } })),
      "/api/career/transition": () => ok(plan()),
    });
    mount("/development");

    const select = await screen.findByLabelText("Task status for PostgreSQL");
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(["not_started", "planned", "in_progress", "completed", "skipped"]);
  });

  it("shows a stale-profile warning after a failed refresh and keeps the previous analysis", async () => {
    handler = routes({
      "/api/career/profile": () => ok(careerProfile({ refresh: { status: "failed", lastAttemptAt: "2026-10-19T00:00:00.000Z", lastSuccessAt: null, lastError: "GitHub rate limit reached." } })),
      "POST /api/career/refresh": () => ok({ status: "failed", analyzedCount: 0, skippedCount: 0, failedCount: 1, analysisId: null, message: "GitHub rate limit reached. Your previous analysis is still shown; try again later.", profileIsStale: true }),
    });
    const user = userEvent.setup();
    mount("/development");

    expect(await screen.findByText(/Your last refresh failed/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Refresh GitHub profile" }));
    expect(await screen.findByText(/previous analysis is still shown; try again later/)).toBeTruthy();
  });
});

describe("Career Copilot", () => {
  const reply = (overrides: Record<string, unknown>) => ({ text: "", interpretedBy: "rules", intent: "unknown", cards: [], actions: [], suggestions: [], ...overrides });

  it("sends a message, renders job cards from the response and explains a match with the job id", async () => {
    handler = routes({
      "/api/copilot/message": (_url, init) => {
        const body = JSON.parse(init!.body as string);
        return ok(
          body.jobId
            ? reply({ intent: "explain_match", text: "Score 78/100 is a weighted similarity.", cards: [{ type: "match", job: job("demo:a"), match: match("demo:a") }] })
            : reply({ intent: "search_jobs", text: "Here are the top 1 of 1 live listings.", cards: [{ type: "jobs", source: "demo", items: [{ job: job("demo:a"), match: match("demo:a"), saved: null }] }], suggestions: ["What are the most important skills I am missing?"] }),
        );
      },
    });
    const user = userEvent.setup();
    mount("/copilot");

    await user.click(await screen.findByRole("button", { name: "Show me remote internships" }));
    expect(await screen.findByText("Here are the top 1 of 1 live listings.")).toBeTruthy();
    expect(screen.getByText("Demo examples — not real vacancies.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open example page/ }).getAttribute("href")).toBe("https://example.com/demo-jobs/backend-intern");

    await user.click(screen.getByRole("button", { name: /Why this match/ }));
    expect(await screen.findByText("Score 78/100 is a weighted similarity.")).toBeTruthy();
    const explain = calls.filter((call) => call.url === "/api/copilot/message").at(-1)!;
    expect(JSON.parse(explain.body as string)).toMatchObject({ jobId: "demo:a" });
  });

  it("types a message and shows loading then error states", async () => {
    let fails = true;
    handler = routes({ "/api/copilot/message": () => (fails ? fail(500, "INTERNAL_ERROR", "boom") : ok(reply({ text: "I can search jobs.", suggestions: [] }))) });
    const user = userEvent.setup();
    mount("/copilot");

    await user.type(await screen.findByLabelText("Your message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toBeTruthy();

    fails = false;
    await user.type(screen.getByLabelText("Your message"), "help");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("I can search jobs.")).toBeTruthy();
  });

  it("wires every action to a real service: refresh, set direction and navigation", async () => {
    handler = routes({
      "/api/copilot/message": () =>
        ok(reply({ text: "Choose.", actions: [{ kind: "refresh-profile", label: "Refresh my GitHub profile" }, { kind: "set-direction", label: "Backend Engineer", directionId: "backend-engineer" }, { kind: "navigate", label: "Open Resume", to: "/resume" }, { kind: "search-demo", label: "Explore demo listings" }] })),
      "POST /api/career/refresh": () => ok({ status: "succeeded", analyzedCount: 2, skippedCount: 0, failedCount: 0, analysisId: "a", message: "Profile refreshed.", profileIsStale: false }),
      "PUT /api/career/direction": () => ok({ directionId: "backend-engineer" }),
    });
    const user = userEvent.setup();
    mount("/copilot");

    await user.type(await screen.findByLabelText("Your message"), "reanalyze");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("link", { name: "Open Resume" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Explore demo listings" }).getAttribute("href")).toBe("/opportunities?source=demo");

    await user.click(screen.getByRole("button", { name: "Refresh my GitHub profile" }));
    expect(await screen.findByText("Profile refreshed.")).toBeTruthy();
    expect(calls.some((call) => call.method === "POST" && call.url === "/api/career/refresh")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Backend Engineer" }));
    expect(await screen.findByText(/Career direction set to Backend Engineer/)).toBeTruthy();
  });

  it("renders a skill-gap summary card for transition requests", async () => {
    handler = routes({ "/api/copilot/message": () => ok(reply({ intent: "transition", text: "For Backend Engineer, your top gaps are PostgreSQL.", cards: [{ type: "transition", analysis: plan() }] })) });
    const user = userEvent.setup();
    mount("/copilot");
    await user.type(await screen.findByLabelText("Your message"), "I want to transition to backend");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Backend Engineer: top skill gaps")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open the full plan/ })).toBeTruthy();
  });
});

describe("Dashboard and preferences", () => {
  it("guides a new user toward a first action when nothing exists yet", async () => {
    handler = routes({
      "/api/career/profile": () => ok(careerProfile({ evidence: { hasGithubAnalysis: false, githubAnalyzedAt: null, hasResume: false, resumeVersion: null } })),
      "/api/opportunities": () => ok(search([], { mode: "live", noProviderConfigured: true, providers: [] })),
    });
    mount("/dashboard");

    expect(await screen.findByText("No live job provider configured")).toBeTruthy();
    expect(screen.getByText("No career direction chosen")).toBeTruthy();
    expect(screen.getByText(/No analysis yet/)).toBeTruthy();
    expect(screen.getByText(/Resume: none yet/)).toBeTruthy();
  });

  it("summarises recommendations, gaps and progress for an active user", async () => {
    handler = routes({
      "/api/career/profile": () => ok(careerProfile({ learning: { direction: "backend-engineer", tasks: {} } })),
      "/api/opportunities": () => ok(search([{ job: job("demo:a"), match: match("demo:a"), saved: null }])),
      "/api/career/transition": () => ok(plan()),
    });
    mount("/dashboard");

    expect(await screen.findByText("Strong match · 78/100")).toBeTruthy();
    expect(await screen.findByText(/Next action:/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Prioritized skill gaps" })).toBeTruthy();
    expect(screen.getByLabelText("Learning progress")).toBeTruthy();
  });

  it("saves preferences through the API", async () => {
    handler = routes({ "PUT /api/career/preferences": (_u, init) => ok(JSON.parse(init!.body as string)) });
    const user = userEvent.setup();
    mount("/preferences");

    await user.click(await screen.findByRole("checkbox", { name: "Remote" }));
    await user.click(screen.getByRole("checkbox", { name: "Backend Engineer" }));
    await user.type(screen.getByLabelText(/Preferred locations/), "Pune, Remote");
    await user.selectOptions(screen.getByLabelText("Your experience level"), "entry");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(await screen.findByText("Preferences saved.")).toBeTruthy();
    expect(JSON.parse(calls.find((call) => call.method === "PUT")!.body as string)).toMatchObject({
      workModes: ["remote"],
      directions: ["backend-engineer"],
      locations: ["Pune", "Remote"],
      experienceLevel: "entry",
    });
  });
});
