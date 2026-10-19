import { useState } from "react";
import { ApiError, apiGet, apiPost } from "../../api/client";
import type { SkillOverview } from "../../api/types";
import { useApiResource } from "../../hooks/useApiResource";
import { SkillOverviewView } from "./SkillOverviewView";

export function SkillOverviewPage() {
  const { state, reload } = useApiResource(() => apiGet<SkillOverview>("/api/skills"), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runScoring() {
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      await apiPost("/api/analysis/run");
      reload();
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.code === "NO_EVIDENCE"
          ? "No evidence is available to score yet. Analyze at least one repository first."
          : error instanceof ApiError
            ? error.message
            : "Scoring failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return <SkillOverviewView state={state} onRetry={reload} onRunScoring={runScoring} scoring={{ busy, message }} />;
}
