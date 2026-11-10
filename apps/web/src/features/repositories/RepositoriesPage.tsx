import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiGet, apiPatch, apiPost } from "../../api/client";
import type { GithubQuota, RepositoryDto, RepositoryListResponse, RepositorySyncSummary, ScoringRunSummary } from "../../api/types";
import { RepositoriesView, type AnalysisProgress, type ListState, type RefreshState, type ScoringState } from "./RepositoriesView";

// Mirrors the backend's MAX_REPOSITORIES_PER_ANALYSIS default. The backend
// remains the authority and its rejection is still surfaced to the user.
export const MAX_SELECTED_REPOSITORIES = 15;

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed.");
}

export function RepositoriesPage() {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [truncated, setTruncated] = useState(false);
  const [quota, setQuota] = useState<GithubQuota | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({ running: false, entries: {} });
  const [reanalyze, setReanalyze] = useState(false);
  const [scoring, setScoring] = useState<ScoringState>({ status: "idle" });
  const [refresh, setRefresh] = useState<RefreshState>({ status: "idle" });
  const analyzing = useRef(false);
  const scoringNow = useRef(false);
  const refreshing = useRef(false);

  const loadQuota = useCallback(async () => {
    try {
      setQuota(await apiGet<GithubQuota>("/api/github/quota"));
    } catch {
      setQuota(null);
    }
  }, []);

  const loadRepositories = useCallback(async (keepExisting: boolean, isUserRefresh = false) => {
    if (!keepExisting) setList({ status: "loading" });

    if (isUserRefresh) {
      if (refreshing.current) return;
      refreshing.current = true;
      setRefresh({ status: "loading" });
    }

    try {
      const data = await apiGet<RepositoryListResponse>("/api/github/repos");
      setList({ status: "success", repositories: data.repositories });
      setTruncated(data.truncated);

      if (isUserRefresh) {
        setRefresh({
          status: "success",
          syncedAt: data.syncedAt,
          sync: data.sync,
        });
      } else {
        // Store syncedAt from initial load too, but without showing a banner
        setRefresh((prev) =>
          prev.status === "idle"
            ? { status: "success", syncedAt: data.syncedAt, sync: data.sync }
            : prev,
        );
      }
    } catch (error) {
      const apiErr = toApiError(error);
      if (isUserRefresh) {
        // Preserve the existing list on a failed explicit refresh
        setRefresh({ status: "error", error: apiErr });
      } else {
        setList({ status: "error", error: apiErr });
      }
    } finally {
      if (isUserRefresh) {
        refreshing.current = false;
      }
    }
  }, []);

  useEffect(() => {
    void loadRepositories(false, false);
    void loadQuota();
  }, [loadRepositories, loadQuota]);

  const patchRepository = (updated: RepositoryDto) =>
    setList((current) =>
      current.status === "success"
        ? { ...current, repositories: current.repositories.map((repo) => (repo.id === updated.id ? { ...repo, ...updated } : repo)) }
        : current,
    );

  async function toggleSelection(repository: RepositoryDto) {
    if (pending.has(repository.id) || progress.running) return;
    setSelectionError(null);
    setPending((current) => new Set(current).add(repository.id));

    try {
      const updated = await apiPatch<RepositoryDto>(`/api/github/repos/${repository.id}/selection`, {
        selected: !repository.selected,
      });
      patchRepository(updated);
    } catch (error) {
      setSelectionError(toApiError(error).message);
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(repository.id);
        return next;
      });
    }
  }

  async function analyzeSelected() {
    if (analyzing.current || list.status !== "success") return;
    const targets = list.repositories.filter((repo) => repo.selected && (reanalyze || !repo.analyzed));
    if (targets.length === 0) return;

    analyzing.current = true;
    setScoring({ status: "idle" });
    let entries: AnalysisProgress["entries"] = Object.fromEntries(
      targets.map((repo) => [repo.id, { status: "queued" as const }]),
    );
    setProgress({ running: true, entries });
    const update = (id: string, entry: AnalysisProgress["entries"][string]) => {
      entries = { ...entries, [id]: entry };
      setProgress({ running: true, entries });
    };

    // Sequential on purpose: each analysis spends GitHub API quota.
    for (const repo of targets) {
      update(repo.id, { status: "running" });
      try {
        await apiPost(`/api/analysis/repositories/${repo.id}`);
        update(repo.id, { status: "success" });
        patchRepository({ ...repo, analyzed: true, analyzedAt: new Date().toISOString() });
      } catch (error) {
        update(repo.id, { status: "failed", message: toApiError(error).message });
      }
    }

    setProgress({ running: false, entries });
    analyzing.current = false;
    await Promise.all([loadRepositories(true, false), loadQuota()]);
  }

  async function runScoring() {
    if (scoringNow.current) return;
    scoringNow.current = true;
    setScoring({ status: "running" });

    try {
      setScoring({ status: "done", summary: await apiPost<ScoringRunSummary>("/api/analysis/run") });
    } catch (error) {
      setScoring({ status: "error", error: toApiError(error) });
    } finally {
      scoringNow.current = false;
    }
  }

  function handleRefresh() {
    void loadRepositories(list.status === "success", true);
    void loadQuota();
  }

  return (
    <RepositoriesView
      list={list}
      truncated={truncated}
      quota={quota}
      maxSelected={MAX_SELECTED_REPOSITORIES}
      pending={pending}
      selectionError={selectionError}
      progress={progress}
      reanalyze={reanalyze}
      scoring={scoring}
      refresh={refresh}
      onToggle={toggleSelection}
      onRefresh={handleRefresh}
      onReanalyzeChange={setReanalyze}
      onAnalyze={analyzeSelected}
      onScore={runScoring}
    />
  );
}
