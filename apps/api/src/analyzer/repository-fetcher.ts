import { githubRequest } from "../services/github-client.service.js";
import { RequestBudget, executeWithBudget } from "../services/request-budget.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { exceedsSizeLimit, hasBinaryExtension, looksBinary } from "./file-safety.js";
import { basename, extensionOf, isInExcludedDirectory, pathDepth } from "./path-utils.js";
import type { TechnologyConfig } from "./technology-config.js";
import type {
  AnalyzerWarning,
  FetchedFile,
  RepositoryTree,
  SupportedManifest,
  TreeEntry,
} from "./types.js";
import { ACTIVITY_WINDOW_DAYS, COMMIT_PAGE_SIZE } from "./activity-analyzer.js";

const MANIFEST_PRIORITY: SupportedManifest[] = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "pom.xml",
];

const MAX_MANIFEST_FETCHES = 2;
const MAX_CONFIG_FETCHES = 2;
const MAX_SOURCE_SAMPLES = 5;

interface GithubTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

interface GithubTreeResponse {
  tree: GithubTreeEntry[];
  truncated: boolean;
}

interface GithubContentsResponse {
  content?: string;
  encoding?: string;
  size: number;
  type: string;
}

interface GithubCommitResponse {
  commit: {
    author?: { date?: string } | null;
    committer?: { date?: string } | null;
  };
}

export interface RepositoryContext {
  owner: string;
  name: string;
  defaultBranch: string;
}

export interface ManifestFile {
  manifest: SupportedManifest;
  path: string;
  file: FetchedFile;
}

export interface NamedFile {
  path: string;
  file: FetchedFile;
}

export interface CommitActivityData {
  commitDates: string[];
  pageSizeReached: boolean;
}

export interface RepositorySnapshot {
  tree: RepositoryTree;
  languages: Record<string, number> | null;
  manifestFiles: ManifestFile[];
  configFiles: NamedFile[];
  readme: NamedFile | null;
  sampledSourceFiles: NamedFile[];
  sourceCandidatePoolSize: number;
  commits: CommitActivityData;
  warnings: AnalyzerWarning[];
}

async function fetchTree(
  accessToken: string,
  context: RepositoryContext,
  budget: RequestBudget,
): Promise<RepositoryTree> {
  const { data } = await executeWithBudget(budget, 1, () =>
    githubRequest<GithubTreeResponse>(
      accessToken,
      `/repos/${context.owner}/${context.name}/git/trees/${encodeURIComponent(context.defaultBranch)}`,
      { searchParams: { recursive: "1" } },
    ),
  );

  const entries: TreeEntry[] = data.tree
    .filter((entry) => entry.type === "blob" || entry.type === "tree")
    .map((entry) => ({
      path: entry.path,
      type: entry.type as "blob" | "tree",
      size: typeof entry.size === "number" ? entry.size : null,
      sha: entry.sha,
    }));

  return { entries, truncated: data.truncated };
}

async function fetchLanguages(
  accessToken: string,
  context: RepositoryContext,
  budget: RequestBudget,
  cachedLanguages: Record<string, number> | null,
): Promise<Record<string, number> | null> {
  if (cachedLanguages && Object.keys(cachedLanguages).length > 0) {
    return cachedLanguages;
  }

  if (!budget.canConsume(1)) {
    return null;
  }

  const { data } = await executeWithBudget(budget, 1, () =>
    githubRequest<Record<string, number>>(
      accessToken,
      `/repos/${context.owner}/${context.name}/languages`,
    ),
  );

  return data;
}

function encodeContentsPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

// Fetches and safely decodes a single repository file via the Contents API.
// Size and extension are checked against the tree-reported metadata *before*
// any GitHub request is made, so an oversized or obviously-binary file never
// spends GitHub API budget at all.
async function fetchFile(
  accessToken: string,
  context: RepositoryContext,
  entry: TreeEntry,
  budget: RequestBudget,
): Promise<FetchedFile> {
  if (exceedsSizeLimit(entry.size)) {
    return { path: entry.path, size: entry.size, status: "skipped_too_large", content: null };
  }

  if (hasBinaryExtension(entry.path)) {
    return { path: entry.path, size: entry.size, status: "skipped_binary", content: null };
  }

  if (!budget.canConsume(1)) {
    return { path: entry.path, size: entry.size, status: "skipped_budget", content: null };
  }

  let data: GithubContentsResponse;

  try {
    const result = await executeWithBudget(budget, 1, () =>
      githubRequest<GithubContentsResponse>(
        accessToken,
        `/repos/${context.owner}/${context.name}/contents/${encodeContentsPath(entry.path)}`,
      ),
    );
    data = result.data;
  } catch (error) {
    if (error instanceof AppError && error.code === AuthErrorCode.GITHUB_NOT_FOUND) {
      return { path: entry.path, size: entry.size, status: "skipped_not_found", content: null };
    }
    throw error;
  }

  if (!data.content || data.encoding !== "base64") {
    return { path: entry.path, size: entry.size, status: "skipped_malformed", content: null };
  }

  if (exceedsSizeLimit(data.size)) {
    return { path: entry.path, size: data.size, status: "skipped_too_large", content: null };
  }

  let decoded: string;

  try {
    decoded = Buffer.from(data.content, "base64").toString("utf-8");
  } catch {
    return { path: entry.path, size: data.size, status: "skipped_malformed", content: null };
  }

  if (looksBinary(decoded)) {
    return { path: entry.path, size: data.size, status: "skipped_binary", content: null };
  }

  return { path: entry.path, size: data.size, status: "decoded", content: decoded };
}

async function fetchCommitActivity(
  accessToken: string,
  context: RepositoryContext,
  budget: RequestBudget,
): Promise<CommitActivityData> {
  const sinceDate = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (!budget.canConsume(1)) {
    return { commitDates: [], pageSizeReached: false };
  }

  try {
    const { data } = await executeWithBudget(budget, 1, () =>
      githubRequest<GithubCommitResponse[]>(
        accessToken,
        `/repos/${context.owner}/${context.name}/commits`,
        { searchParams: { since: sinceDate.toISOString(), per_page: String(COMMIT_PAGE_SIZE) } },
      ),
    );

    const commitDates = data
      .map((commit) => commit.commit.author?.date ?? commit.commit.committer?.date)
      .filter((date): date is string => typeof date === "string");

    return { commitDates, pageSizeReached: data.length >= COMMIT_PAGE_SIZE };
  } catch (error) {
    if (error instanceof AppError && error.code === AuthErrorCode.GITHUB_NOT_FOUND) {
      return { commitDates: [], pageSizeReached: false };
    }
    throw error;
  }
}

function findReadmeEntry(tree: RepositoryTree): TreeEntry | null {
  const candidates = tree.entries.filter(
    (entry) => entry.type === "blob" && /^readme(\.(md|markdown|txt))?$/i.test(basename(entry.path)),
  );

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const depthDiff = pathDepth(a.path) - pathDepth(b.path);
    return depthDiff !== 0 ? depthDiff : a.path.localeCompare(b.path);
  });

  return candidates[0];
}

function findManifestCandidates(tree: RepositoryTree): Array<{ manifest: SupportedManifest; entry: TreeEntry }> {
  const candidates: Array<{ manifest: SupportedManifest; entry: TreeEntry }> = [];

  for (const entry of tree.entries) {
    if (entry.type !== "blob") {
      continue;
    }

    const name = basename(entry.path);
    const manifest = MANIFEST_PRIORITY.find((candidate) => candidate === name);

    if (manifest) {
      candidates.push({ manifest, entry });
    }
  }

  candidates.sort((a, b) => {
    const priorityDiff =
      MANIFEST_PRIORITY.indexOf(a.manifest) - MANIFEST_PRIORITY.indexOf(b.manifest);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const depthDiff = pathDepth(a.entry.path) - pathDepth(b.entry.path);
    return depthDiff !== 0 ? depthDiff : a.entry.path.localeCompare(b.entry.path);
  });

  return candidates;
}

function findConfigFileCandidates(tree: RepositoryTree, config: TechnologyConfig): TreeEntry[] {
  const configFileNames = new Set<string>();

  for (const technology of config.technologies) {
    for (const pattern of technology.configFilePatterns) {
      configFileNames.add(pattern.toLowerCase());
    }
  }

  const candidates = tree.entries.filter(
    (entry) => entry.type === "blob" && configFileNames.has(basename(entry.path).toLowerCase()),
  );

  candidates.sort((a, b) => {
    const depthDiff = pathDepth(a.path) - pathDepth(b.path);
    return depthDiff !== 0 ? depthDiff : a.path.localeCompare(b.path);
  });

  return candidates;
}

function findSourceCandidates(
  tree: RepositoryTree,
  config: TechnologyConfig,
  excludePaths: Set<string>,
): TreeEntry[] {
  const relevantExtensions = new Set<string>();

  for (const technology of config.technologies) {
    for (const extension of technology.sourceFileExtensions) {
      relevantExtensions.add(extension);
    }
  }

  const candidates = tree.entries.filter(
    (entry) =>
      entry.type === "blob" &&
      !excludePaths.has(entry.path) &&
      !isInExcludedDirectory(entry.path) &&
      relevantExtensions.has(extensionOf(entry.path)),
  );

  // Deterministic, bounded selection: shallowest paths first, then
  // alphabetical — never random, never dependent on network timing.
  candidates.sort((a, b) => {
    const depthDiff = pathDepth(a.path) - pathDepth(b.path);
    return depthDiff !== 0 ? depthDiff : a.path.localeCompare(b.path);
  });

  return candidates;
}

// Orchestrates every GitHub request Phase 3 makes for a single repository,
// strictly through the shared `budget`. Optional steps degrade gracefully
// (skipped, with a warning where useful) once the budget runs low; only the
// mandatory tree fetch is allowed to propagate a budget-exceeded failure.
export async function fetchRepositorySnapshot(
  accessToken: string,
  context: RepositoryContext,
  cachedLanguages: Record<string, number> | null,
  config: TechnologyConfig,
  budget: RequestBudget,
): Promise<RepositorySnapshot> {
  const warnings: AnalyzerWarning[] = [];

  const tree = await fetchTree(accessToken, context, budget);

  if (tree.truncated) {
    warnings.push({
      code: "TREE_TRUNCATED",
      message: "GitHub truncated the repository tree listing; analysis covers a partial view.",
    });
  }

  const languages = await fetchLanguages(accessToken, context, budget, cachedLanguages);

  const manifestCandidates = findManifestCandidates(tree).slice(0, MAX_MANIFEST_FETCHES);
  const manifestFiles: ManifestFile[] = [];

  for (const candidate of manifestCandidates) {
    const file = await fetchFile(accessToken, context, candidate.entry, budget);
    manifestFiles.push({ manifest: candidate.manifest, path: candidate.entry.path, file });
  }

  const configCandidates = findConfigFileCandidates(tree, config).slice(0, MAX_CONFIG_FETCHES);
  const configFiles: NamedFile[] = [];

  for (const candidate of configCandidates) {
    const file = await fetchFile(accessToken, context, candidate, budget);
    configFiles.push({ path: candidate.path, file });
  }

  const readmeEntry = findReadmeEntry(tree);
  let readme: NamedFile | null = null;

  if (readmeEntry) {
    const file = await fetchFile(accessToken, context, readmeEntry, budget);
    readme = { path: readmeEntry.path, file };
  }

  const commits = await fetchCommitActivity(accessToken, context, budget);

  const alreadyFetchedPaths = new Set<string>([
    ...manifestFiles.map((entry) => entry.path),
    ...configFiles.map((entry) => entry.path),
    ...(readme ? [readme.path] : []),
  ]);

  const sourceCandidates = findSourceCandidates(tree, config, alreadyFetchedPaths);
  const sampledSourceFiles: NamedFile[] = [];

  for (const candidate of sourceCandidates) {
    if (sampledSourceFiles.length >= MAX_SOURCE_SAMPLES || !budget.canConsume(1)) {
      break;
    }

    const file = await fetchFile(accessToken, context, candidate, budget);
    sampledSourceFiles.push({ path: candidate.path, file });
  }

  if (sourceCandidates.length > sampledSourceFiles.length) {
    warnings.push({
      code: "PARTIAL_SOURCE_INSPECTION",
      message:
        "The GitHub request budget did not allow inspecting every candidate source file; source usage reflects a bounded sample.",
    });
  }

  return {
    tree,
    languages,
    manifestFiles,
    configFiles,
    readme,
    sampledSourceFiles,
    sourceCandidatePoolSize: sourceCandidates.length,
    commits,
    warnings,
  };
}
