import { useRef, useState } from "react";
import { ApiError, apiGet, apiPost } from "../../api/client";
import type { GapAnalysisResponse, GapExplanationResponse, RoleCatalogResponse } from "../../api/types";
import { useApiResource } from "../../hooks/useApiResource";
import type { ExplanationState } from "./ExplanationPanel";
import { RolesView, type GapRunState } from "./RolesView";

export function RolesPage() {
  const { state, reload } = useApiResource(() => apiGet<RoleCatalogResponse>("/api/roles"), []);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [run, setRun] = useState<GapRunState>({ status: "idle" });
  // Identifies the latest request so a slow response for a previously selected
  // role can never overwrite the result of the current one.
  const requestToken = useRef(0);
  const [explanation, setExplanation] = useState<ExplanationState>({ status: "idle" });
  // Same guard for explanations: a response only applies to the analysis it was requested for.
  const explainToken = useRef(0);

  function select(roleId: string) {
    requestToken.current += 1;
    explainToken.current += 1;
    setSelectedRoleId(roleId);
    setRun({ status: "idle" });
    setExplanation({ status: "idle" });
  }

  async function runGapAnalysis() {
    if (!selectedRoleId || run.status === "running") return;
    const token = ++requestToken.current;
    explainToken.current += 1;
    setExplanation({ status: "idle" });
    setRun({ status: "running" });

    try {
      const result = await apiPost<GapAnalysisResponse>("/api/gap-analysis", { roleId: selectedRoleId });
      if (token === requestToken.current) setRun({ status: "done", result });
    } catch (error) {
      if (token === requestToken.current) {
        setRun({
          status: "error",
          error: error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed."),
        });
      }
    }
  }

  async function explain() {
    if (run.status !== "done" || explanation.status === "loading") return;
    const token = ++explainToken.current;
    setExplanation({ status: "loading" });

    try {
      const result = await apiPost<GapExplanationResponse>(`/api/gap-analysis/${run.result.id}/explanation`);
      if (token === explainToken.current) setExplanation({ status: "done", result });
    } catch (error) {
      if (token === explainToken.current) {
        setExplanation({
          status: "error",
          error: error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed."),
        });
      }
    }
  }

  return (
    <RolesView
      roles={state}
      selectedRoleId={selectedRoleId}
      onSelect={select}
      onRun={runGapAnalysis}
      onRetryRoles={reload}
      run={run}
      explanation={explanation}
      onExplain={explain}
    />
  );
}
