// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { GapAnalysisResponse, GapExplanationResponse } from "../../api/types";
import { ExplanationPanel } from "./ExplanationPanel";
import { RolesPage } from "./RolesPage";

const noop = () => undefined;

const analysis: GapAnalysisResponse = {
  id: "g1",
  analysisId: "a1",
  scoringVersion: "1.0.0",
  roleCatalogVersion: "1.0.0",
  createdAt: "2026-03-02T00:00:00.000Z",
  roleId: "ai-engineer",
  roleName: "AI Engineer",
  roleMatch: 61.234,
  requirements: [
    { skillId: "python", skillName: "Python", evidenceScore: 80, evidenceAvailable: true, weight: 0.6, minimumScore: 60, weightedContribution: 48, gap: 20, deficit: 0, criticalGap: false },
    { skillId: "docker", skillName: "Docker", evidenceScore: 0, evidenceAvailable: false, weight: 0.4, minimumScore: 40, weightedContribution: 0, gap: -40, deficit: 40, criticalGap: true },
  ],
  criticalGaps: [],
};

const explanation: GapExplanationResponse = {
  gapAnalysisId: "g1",
  roleId: "ai-engineer",
  promptVersion: "1.0.0",
  generatedAt: "2026-03-02T00:00:00.000Z",
  explanation: {
    summary: "Python looks strong.",
    strengths: ["Python evidence meets its minimum."],
    priorityGaps: [{ skillId: "docker", explanation: "No Docker evidence was found; this does not show the skill is absent." }],
    recommendedActions: ["Containerize one project."],
    limitations: ["Only public GitHub signals are considered."],
  },
};

const markup = (state: Parameters<typeof ExplanationPanel>[0]["state"]) =>
  renderToStaticMarkup(<MemoryRouter><ExplanationPanel analysis={analysis} state={state} onExplain={noop} /></MemoryRouter>);

describe("ExplanationPanel", () => {
  it("offers a labelled, optional action and says scores are deterministic", () => {
    const html = markup({ status: "idle" });

    expect(html).toContain("AI Explanation");
    expect(html).toContain("deterministic scoring engine");
    expect(html).toContain("Generate explanation");
  });

  it("disables the button while loading", () => {
    expect(markup({ status: "loading" })).toMatch(/<button[^>]*disabled[^>]*>Generating\.\.\.<\/button>/);
  });

  it("renders every structured section, labelled as AI-generated, with names from the deterministic result", () => {
    const html = markup({ status: "done", result: explanation });

    for (const heading of ["Overall summary", "Observed strengths", "Priority gaps", "Recommended next actions", "Limitations"]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("AI-generated explanation");
    expect(html).toContain("Docker:");
    expect(html).toContain("Regenerate explanation");
  });

  it("shows a not-configured message without alarming wording", () => {
    const html = markup({ status: "error", error: new ApiError(503, "LLM_NOT_CONFIGURED", "x") });

    expect(html).toContain("have not been configured");
    expect(html).toContain("unaffected");
  });

  it("ignores any score-like fields in model output", () => {
    const tampered = { ...explanation, explanation: { ...explanation.explanation, roleMatch: 100, evidenceScore: 99 } };
    const html = markup({ status: "done", result: tampered as GapExplanationResponse });

    expect(html).not.toContain("99");
    expect(html).not.toContain("100");
  });
});

// Drives RolesPage against a stubbed network.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const catalog = {
  catalogVersion: "1.0.0",
  roles: ["ai-engineer", "ml-engineer"].map((id) => ({
    id,
    displayName: id === "ai-engineer" ? "AI Engineer" : "ML Engineer",
    requirements: [{ skillId: "python", skillName: "Python", weight: 1, minimumScore: 50 }],
  })),
};

const envelope = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });
const failure = (status: number, code: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message: "Provider down." } }), { status });

describe("RolesPage explanation flow", () => {
  let explainCalls: Array<ReturnType<typeof deferred<Response>>>;

  beforeEach(() => {
    explainCalls = [];
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/roles") return Promise.resolve(envelope(catalog));
      if (url === "/api/gap-analysis") return Promise.resolve(envelope(analysis, 201));
      if (url === "/api/gap-analysis/g1/explanation") {
        const call = deferred<Response>();
        explainCalls.push(call);
        return call.promise;
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function openResult() {
    const user = userEvent.setup();
    render(<MemoryRouter><RolesPage /></MemoryRouter>);
    await user.click(await screen.findByLabelText("AI Engineer"));
    await user.click(screen.getByRole("button", { name: "Run gap analysis" }));
    await screen.findByText("AI Engineer: Role Match");
    return user;
  }

  it("shows the action only after a gap analysis and keeps deterministic results during loading", async () => {
    const user = await openResult();
    await user.click(screen.getByRole("button", { name: "Generate explanation" }));

    expect((screen.getByRole("button", { name: "Generating..." }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("61.2")).toBeTruthy();
  });

  it("prevents duplicate submissions and renders the result", async () => {
    const user = await openResult();
    const button = screen.getByRole("button", { name: "Generate explanation" });
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Generating..." }));

    expect(explainCalls).toHaveLength(1);
    explainCalls[0]!.resolve(envelope(explanation));
    expect(await screen.findByText("Python looks strong.")).toBeTruthy();
    expect(screen.getByText("61.2")).toBeTruthy();
  });

  it("shows a provider error, keeps the analysis and allows a retry", async () => {
    const user = await openResult();
    await user.click(screen.getByRole("button", { name: "Generate explanation" }));
    explainCalls[0]!.resolve(failure(503, "LLM_UNAVAILABLE"));

    expect(await screen.findByText(/Provider down\./)).toBeTruthy();
    expect(screen.getByText("AI Engineer: Role Match")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(explainCalls).toHaveLength(2));
    explainCalls[1]!.resolve(envelope(explanation));
    expect(await screen.findByText("Python looks strong.")).toBeTruthy();
  });

  it("discards a late explanation after the role changes", async () => {
    const user = await openResult();
    await user.click(screen.getByRole("button", { name: "Generate explanation" }));
    await user.click(screen.getByLabelText("ML Engineer"));
    explainCalls[0]!.resolve(envelope(explanation));

    await waitFor(() => expect(screen.queryByText("AI Engineer: Role Match")).toBeNull());
    expect(screen.queryByText("Python looks strong.")).toBeNull();
  });
});
