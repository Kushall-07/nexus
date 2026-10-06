import { buildEvidenceKey, findSkill, type NewEvidenceItem } from "@nexus/domain";
import type { RepositoryAnalysis } from "../analyzer/types.js";
import { buildEvidence, type BuildEvidenceResult } from "../evidence/evidence-builder.js";
import { loadEvidenceConfig } from "../evidence/evidence-config.js";
import { EvidenceModel } from "../models/evidence.model.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

export interface PublicEvidenceItem {
  repositoryId: string;
  skillId: string;
  evidenceType: string;
  signal: string;
  value: string | number;
  normalizedStrength: number;
  sourcePath?: string;
  sourceReference?: string;
  explanation: string;
  detectedAt: string;
}

// The API-facing evidence shape. It deliberately omits userId and the
// internal evidence key.
export function toPublicEvidence(
  item: Omit<NewEvidenceItem, "userId" | "observationKey" | "detectedAt"> & {
    detectedAt: Date | string;
  },
): PublicEvidenceItem {
  return {
    repositoryId: String(item.repositoryId),
    skillId: item.skillId,
    evidenceType: item.evidenceType,
    signal: item.signal,
    value: item.value,
    normalizedStrength: item.normalizedStrength,
    ...(item.sourcePath ? { sourcePath: item.sourcePath } : {}),
    ...(item.sourceReference ? { sourceReference: item.sourceReference } : {}),
    explanation: item.explanation,
    detectedAt: new Date(item.detectedAt).toISOString(),
  };
}

// Makes the stored evidence for one user repository exactly equal to `items`.
// Idempotent: documents are upserted by their deterministic evidence key, then
// any key no longer produced (stale evidence from an earlier analysis) is
// removed. Upserting first means readers never observe an empty window.
export async function replaceRepositoryEvidence(
  userId: string,
  repositoryId: string,
  items: NewEvidenceItem[],
): Promise<void> {
  const keys = items.map((item) => buildEvidenceKey(item));

  if (items.length > 0) {
    await EvidenceModel.bulkWrite(
      items.map((item, index) => {
        const unset: Record<string, ""> = {};

        // A re-run that no longer reports an optional field must clear it.
        if (!item.sourcePath) {
          unset.sourcePath = "";
        }
        if (!item.sourceReference) {
          unset.sourceReference = "";
        }

        return {
          updateOne: {
            filter: { userId, repositoryId, evidenceKey: keys[index] },
            update: {
              $set: {
                skillId: item.skillId,
                evidenceType: item.evidenceType,
                signal: item.signal,
                value: item.value,
                normalizedStrength: item.normalizedStrength,
                ...(item.sourcePath ? { sourcePath: item.sourcePath } : {}),
                ...(item.sourceReference ? { sourceReference: item.sourceReference } : {}),
                explanation: item.explanation,
                detectedAt: item.detectedAt,
              },
              ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  await EvidenceModel.deleteMany({ userId, repositoryId, evidenceKey: { $nin: keys } });
}

// Phase 4 entry point used by the analysis flow: consumes an already
// completed Phase 3 analysis (no GitHub access) and persists its evidence.
export async function generateRepositoryEvidence(
  userId: string,
  analysis: RepositoryAnalysis,
): Promise<BuildEvidenceResult> {
  const result = buildEvidence({
    userId,
    repositoryId: analysis.repositoryId,
    analysis,
    detectedAt: new Date(analysis.analyzedAt),
  });

  await replaceRepositoryEvidence(userId, analysis.repositoryId, result.items);

  return result;
}

// User-scoped read: only ever returns evidence owned by `userId`.
export async function listSkillEvidence(
  userId: string,
  skillId: string,
  repositoryId?: string,
): Promise<PublicEvidenceItem[]> {
  const { taxonomy } = loadEvidenceConfig();

  if (!findSkill(taxonomy, skillId)) {
    throw new AppError(AuthErrorCode.SKILL_NOT_FOUND, 404, "Skill not found.");
  }

  const documents = await EvidenceModel.find({
    userId,
    skillId,
    ...(repositoryId ? { repositoryId } : {}),
  })
    .sort({ repositoryId: 1, evidenceType: 1, sourcePath: 1, evidenceKey: 1 })
    .lean();

  return documents.map((document) => toPublicEvidence(document as never));
}
