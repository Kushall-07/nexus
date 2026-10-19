import { useRef, useState } from "react";
import { ApiError, apiGet, apiPost } from "../../api/client";
import type { GapAnalysisResponse, RoleCatalogResponse } from "../../api/types";
import { useApiResource } from "../../hooks/useApiResource";
import { RolesView, type GapRunState } from "./RolesView";

export function RolesPage() {
  const { state, reload } = useApiResource(() => apiGet<RoleCatalogResponse>("/api/roles"), []);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [run, setRun] = useState<GapRunState>({ status: "idle" });
  // Identifies the latest request so a slow response for a previously selected
  // role can never overwrite the result of the current one.
  const requestToken = useRef(0);

  function select(roleId: string) {
    requestToken.current += 1;
    setSelectedRoleId(roleId);
    setRun({ status: "idle" });
  }

  async function runGapAnalysis() {
    if (!selectedRoleId || run.status === "running") return;
    const token = ++requestToken.current;
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

  return (
    <RolesView
      roles={state}
      selectedRoleId={selectedRoleId}
      onSelect={select}
      onRun={runGapAnalysis}
      onRetryRoles={reload}
      run={run}
    />
  );
}
