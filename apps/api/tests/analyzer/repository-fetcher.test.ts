import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRepositorySnapshot } from "../../src/analyzer/repository-fetcher.js";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";
import { RequestBudget } from "../../src/services/request-budget.js";

const config = loadTechnologyConfig();
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

function buildFetchRouter(options: {
  treeEntries: TreeEntryFixture[];
  fileContents: Record<string, string>;
  languages?: Record<string, number>;
  commits?: Array<{ date: string }>;
  treeTruncated?: boolean;
}) {
  const calls: string[] = [];

  const handler = vi.fn(async (input: string | URL) => {
    const url = typeof input === "string" ? new URL(input) : input;
    calls.push(url.pathname + (url.search ?? ""));

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
          truncated: options.treeTruncated ?? false,
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
        JSON.stringify({ content: base64Of(content), encoding: "base64", size: content.length, type: "file" }),
        { status: 200 },
      );
    }

    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  });

  vi.stubGlobal("fetch", handler);

  return { calls, handler };
}

describe("fetchRepositorySnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches tree, manifests, config, readme, commits, and samples source files within budget", async () => {
    const { calls } = buildFetchRouter({
      treeEntries: [
        { path: "package.json", type: "blob", size: 100 },
        { path: "requirements.txt", type: "blob", size: 50 },
        { path: "next.config.js", type: "blob", size: 30 },
        { path: "README.md", type: "blob", size: 40 },
        { path: "Dockerfile", type: "blob", size: 20 },
        { path: "src/App.tsx", type: "blob", size: 60 },
        { path: "src/Other.tsx", type: "blob", size: 60 },
      ],
      fileContents: {
        "package.json": JSON.stringify({ dependencies: { next: "^14.0.0" } }),
        "requirements.txt": "fastapi\n",
        "next.config.js": "module.exports = {};",
        "README.md": "# Demo",
        "src/App.tsx": "import React from 'react';",
        "src/Other.tsx": "export const x = 1;",
      },
      commits: [{ date: "2026-01-01T00:00:00Z" }],
    });

    const budget = new RequestBudget(10);
    const snapshot = await fetchRepositorySnapshot(ACCESS_TOKEN, CONTEXT, null, config, budget);

    expect(budget.used).toBeLessThanOrEqual(10);
    expect(snapshot.manifestFiles.map((m) => m.path).sort()).toEqual([
      "package.json",
      "requirements.txt",
    ]);
    expect(snapshot.configFiles.map((c) => c.path)).toEqual(["next.config.js"]);
    expect(snapshot.readme?.path).toBe("README.md");
    expect(snapshot.commits.commitDates).toEqual(["2026-01-01T00:00:00Z"]);
    expect(snapshot.sampledSourceFiles.map((f) => f.path).sort()).toEqual([
      "src/App.tsx",
      "src/Other.tsx",
    ]);
    expect(calls.length).toBe(budget.used);
  });

  it("never exceeds the configured per-repository request budget", async () => {
    const { calls } = buildFetchRouter({
      treeEntries: Array.from({ length: 30 }, (_, i) => ({
        path: `src/File${i}.ts`,
        type: "blob" as const,
        size: 10,
      })),
      fileContents: Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [`src/File${i}.ts`, `export const x${i} = ${i};`]),
      ),
    });

    const budget = new RequestBudget(10);
    await fetchRepositorySnapshot(ACCESS_TOKEN, CONTEXT, null, config, budget);

    expect(budget.used).toBeLessThanOrEqual(10);
    expect(calls.length).toBeLessThanOrEqual(10);
  });

  it("does not keep searching indefinitely when optional files are missing", async () => {
    const { calls } = buildFetchRouter({
      treeEntries: [{ path: "src/index.ts", type: "blob", size: 10 }],
      fileContents: { "src/index.ts": "export const a = 1;" },
      // No package.json, no README, no Dockerfile, no config files anywhere.
    });

    const budget = new RequestBudget(10);
    const snapshot = await fetchRepositorySnapshot(ACCESS_TOKEN, CONTEXT, null, config, budget);

    expect(snapshot.manifestFiles).toEqual([]);
    expect(snapshot.readme).toBeNull();
    expect(snapshot.configFiles).toEqual([]);
    // tree + languages + commits + one source file sample = 4 requests, not
    // an unbounded search for files that don't exist.
    expect(calls.length).toBe(4);
  });

  it("degrades gracefully instead of throwing when the budget is exhausted mid-analysis", async () => {
    buildFetchRouter({
      treeEntries: [
        { path: "package.json", type: "blob", size: 10 },
        { path: "requirements.txt", type: "blob", size: 10 },
        { path: "README.md", type: "blob", size: 10 },
      ],
      fileContents: {
        "package.json": "{}",
        "requirements.txt": "flask\n",
        "README.md": "# demo",
      },
    });

    // Only enough budget for the tree + languages + one manifest fetch.
    const budget = new RequestBudget(3);
    const snapshot = await fetchRepositorySnapshot(ACCESS_TOKEN, CONTEXT, null, config, budget);

    expect(budget.used).toBe(3);
    expect(budget.remaining).toBe(0);

    const skippedForBudget = snapshot.manifestFiles.some(
      (m) => m.file.status === "skipped_budget",
    );
    expect(skippedForBudget || snapshot.manifestFiles.length <= 1).toBe(true);
    expect(snapshot.readme?.file.status).toBe("skipped_budget");
  });

  it("reuses cached languages instead of making a GitHub request", async () => {
    const { calls } = buildFetchRouter({
      treeEntries: [],
      fileContents: {},
    });

    const budget = new RequestBudget(10);
    await fetchRepositorySnapshot(
      ACCESS_TOKEN,
      CONTEXT,
      { TypeScript: 1000 },
      config,
      budget,
    );

    expect(calls.some((call) => call.endsWith("/languages"))).toBe(false);
  });

  it("selects manifests deterministically by priority and path depth", async () => {
    buildFetchRouter({
      treeEntries: [
        { path: "nested/dir/pom.xml", type: "blob", size: 10 },
        { path: "package.json", type: "blob", size: 10 },
        { path: "go.mod", type: "blob", size: 10 },
      ],
      fileContents: {
        "nested/dir/pom.xml": "<project></project>",
        "package.json": "{}",
        "go.mod": "module demo\n",
      },
    });

    const budget = new RequestBudget(10);
    const snapshot = await fetchRepositorySnapshot(ACCESS_TOKEN, CONTEXT, null, config, budget);

    // package.json (priority 0) and go.mod (priority 3) rank ahead of
    // pom.xml (priority 4); only MAX_MANIFEST_FETCHES=2 are fetched.
    expect(snapshot.manifestFiles.map((m) => m.manifest)).toEqual(["package.json", "go.mod"]);
  });

  it("skips files over the size limit without spending a GitHub request", async () => {
    const { calls } = buildFetchRouter({
      treeEntries: [{ path: "package.json", type: "blob", size: 2 * 1024 * 1024 }],
      fileContents: { "package.json": "{}" },
    });

    const budget = new RequestBudget(10);
    const snapshot = await fetchRepositorySnapshot(ACCESS_TOKEN, CONTEXT, null, config, budget);

    expect(snapshot.manifestFiles[0]?.file.status).toBe("skipped_too_large");
    expect(calls.some((call) => call.includes("/contents/package.json"))).toBe(false);
  });

  it("surfaces a TREE_TRUNCATED warning when GitHub truncates the tree", async () => {
    buildFetchRouter({ treeEntries: [], fileContents: {}, treeTruncated: true });

    const budget = new RequestBudget(10);
    const snapshot = await fetchRepositorySnapshot(ACCESS_TOKEN, CONTEXT, null, config, budget);

    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "TREE_TRUNCATED" })]),
    );
  });
});
