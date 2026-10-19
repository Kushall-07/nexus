import { useParams } from "react-router-dom";
import { apiGet } from "../../api/client";
import type { SkillDetail, SkillEvidenceResponse } from "../../api/types";
import { useApiResource } from "../../hooks/useApiResource";
import { SkillDetailView } from "./SkillDetailView";

export function SkillDetailPage() {
  const { skillId = "" } = useParams();
  const encoded = encodeURIComponent(skillId);

  const detail = useApiResource(() => apiGet<SkillDetail>(`/api/skills/${encoded}`), [encoded]);
  const evidence = useApiResource(() => apiGet<SkillEvidenceResponse>(`/api/skills/${encoded}/evidence`), [encoded]);

  return (
    <SkillDetailView
      detail={detail.state}
      evidence={evidence.state}
      onRetryDetail={detail.reload}
      onRetryEvidence={evidence.reload}
    />
  );
}
