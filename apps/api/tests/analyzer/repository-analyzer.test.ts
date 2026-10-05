import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeRepository } from "../../src/analyzer/repository-analyzer.js";

const ACCESS_TOKEN = "gho_fake_token";
const CONTEXT = { owner: "octocat", name: "demo", defaultBranch: "main" };

function base64Of(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

interface TreeEntryFixture {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

function stubGithub(options: {
  treeEntries: TreeEntryFixture[];
  fileContents: Record<string, string>;
  languages?: Record<string, number>;
  commits?: Array<{ date: string }>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? new URL(input) : input;

      if (url.pathname.endsWith("/git/trees/main")) {
        return new Response(
          JSON.stringify({
            tree: options.treeEntries.map((entry) => ({
              path: entry.path,
              mode: "100644",
              type: entry.type,
              sha: "sha-" + entry.path,
              size: entry.size,
            })),
            truncated: false,
          }),
          { status: 200 },
        );
      }

      if (url.pathname.endsWith("/languages")) {
        return new Response(JSON.stringify(options.languages ?? {}), { status: 200 });
      }

      if (url.pathname.endsWith("/commits")) {
        return new Response(
          JSON.stringify(
            (options.commits ?? []).map((c) => ({ commit: { author: { date: c.date } } })),
          ),
          { status: 200 },
        );
      }

      if (url.pathname.includes("/contents/")) {
        const path = decodeURIComponent(url.pathname.split("/contents/")[1]);
        const content = options.fileContents[path];

        if (content === undefined) {
          return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
        }

        return new Response(
          JSON.stringify({ content: base64Of(content), encoding: "base64", size: content.length }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }),
  );
}

describe("analyzeRepository (integration)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces one deterministic normalized result from mocked GitHub responses", async () => {
    stubGithub({
      treeEntries: [
        { path: "package.json", type: "blob", size: 100 },
        { path: "README.md", type: "blob", size: 40 },
        { path: "Dockerfile", type: "blob", size: 20 },
        { path: "src/App.tsx", type: "blob", size: 60 },
        { path: "src/App.test.tsx", type: "blob", size: 60 },
        { path: "src/components/Button.tsx", type: "blob", size: 40 },
      ],
      fileContents: {
        "package.json": JSON.stringify({ dependencies: { react: "^18.0.0" } }),
        "README.md": "# Demo\n\nBuilt with React.",
        "src/App.tsx": "import React from 'react';",
        "src/App.test.tsx": "import React from 'react';",
        "src/components/Button.tsx": "import React from 'react';",
      },
      languages: { TypeScript: 8000, JavaScript: 2000 },
      commits: [{ date: "2026-01-01T00:00:00Z" }, { date: "2026-01-02T00:00:00Z" }],
    });

    const input = {
      accessToken: ACCESS_TOKEN,
      repositoryId: "repo-1",
      context: CONTEXT,
      cachedLanguages: null,
      requestBudgetLimit: 10,
    };

    const result = await analyzeRepository(input);

    expect(result.repositoryFullName).toBe("octocat/demo");
    expect(result.languages.percentageByLanguage).toEqual({ TypeScript: 80, JavaScript: 20 });
    expect(result.dependencies).toEqual(
      expect.arrayContaining([expect.objectContaining({ packageName: "react", technology: "react" })]),
    );
    expect(result.frameworks.map((f) => f.technology)).toContain("react");
    expect(result.docker.dockerfilePresent).toBe(true);
    expect(result.documentation.readmePresent).toBe(true);
    expect(result.activity.recentCommitCount).toBe(2);
    expect(result.requestBudget.limit).toBe(10);
    expect(result.requestBudget.used).toBeLessThanOrEqual(10);

    const reactUsage = result.sourceUsage.find((s) => s.technology === "react");
    expect(reactUsage).toBeDefined();
    expect(reactUsage!.sourceUsage).toBeGreaterThan(0);

    // Determinism: re-running against identical mocked input yields an
    // identical result, aside from wall-clock fields (analyzedAt, the
    // activity window's sinceDate) that are expected to vary by call time.
    const second = await analyzeRepository(input);
    const normalize = (analysis: typeof result) => ({
      ...analysis,
      analyzedAt: null,
      activity: { ...analysis.activity, sinceDate: null },
    });
    expect(normalize(result)).toEqual(normalize(second));
  });

  it("never scores skills, matches roles, or calls an LLM — only produces observations", async () => {
    stubGithub({ treeEntries: [], fileContents: {} });

    const result = await analyzeRepository({
      accessToken: ACCESS_TOKEN,
      repositoryId: "repo-2",
      context: CONTEXT,
      cachedLanguages: null,
      requestBudgetLimit: 10,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("score");
    expect(serialized).not.toContain("Score");
    expect(serialized).not.toContain("role");
    expect(serialized).not.toContain("expert");
  });

  it("handles an empty repository without crashing", async () => {
    stubGithub({ treeEntries: [], fileContents: {} });

    await expect(
      analyzeRepository({
        accessToken: ACCESS_TOKEN,
        repositoryId: "repo-3",
        context: CONTEXT,
        cachedLanguages: null,
        requestBudgetLimit: 10,
      }),
    ).resolves.toBeDefined();
  });

  it("produces structured warnings for an unsupported manifest in the tree", async () => {
    stubGithub({
      treeEntries: [{ path: "Cargo.toml", type: "blob", size: 10 }],
      fileContents: { "Cargo.toml": "[package]\nname = \"demo\"" },
    });

    const result = await analyzeRepository({
      accessToken: ACCESS_TOKEN,
      repositoryId: "repo-4",
      context: CONTEXT,
      cachedLanguages: null,
      requestBudgetLimit: 10,
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_MANIFEST", path: "Cargo.toml" }),
      ]),
    );
    expect(result.dependencies.some((d) => d.source === "Cargo.toml" as never)).toBe(false);
  });

  it("surfaces a malformed-manifest warning without failing the whole analysis", async () => {
    stubGithub({
      treeEntries: [{ path: "package.json", type: "blob", size: 20 }],
      fileContents: { "package.json": "{not valid json" },
    });

    const result = await analyzeRepository({
      accessToken: ACCESS_TOKEN,
      repositoryId: "repo-5",
      context: CONTEXT,
      cachedLanguages: null,
      requestBudgetLimit: 10,
    });

    expect(result.dependencies).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "MALFORMED_MANIFEST" })]),
    );
  });
});
