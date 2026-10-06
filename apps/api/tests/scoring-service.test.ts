import { beforeEach, describe, expect, it, vi } from "vitest";

const repoFindMock = vi.fn();
const evidenceFindMock = vi.fn();
const createMock = vi.fn();

vi.mock("../src/models/repository.model.js", () => ({
  RepositoryModel: { find: (...args: unknown[]) => repoFindMock(...args) },
}));
vi.mock("../src/models/evidence.model.js", () => ({
  EvidenceModel: { find: (...args: unknown[]) => evidenceFindMock(...args) },
}));
vi.mock("../src/models/analysis.model.js", () => ({
  AnalysisModel: { create: (...args: unknown[]) => createMock(...args) },
}));

const { scoreUserEvidence } = await import("../src/services/scoring.service.js");
const { loadScoringConfig, resetScoringConfigCache } = await import("../src/scoring/scoring-config.js");

const USER = "507f1f77bcf86cd799439011";
const REPO_A = "607f1f77bcf86cd799439021";
const REPO_B = "607f1f77bcf86cd799439022";
const REPO_OLD = "607f1f77bcf86cd799439023";

const lean = <T>(value: T) => ({ lean: () => Promise.resolve(value) });

function evidenceDoc(id: string, repositoryId: string, skillId: string, signal: string, strength: number) {
  return { _id: id, repositoryId, skillId, signal, normalizedStrength: strength, detectedAt: new Date() };
}

describe("scoring configuration loader", () => {
  it("loads and validates config/scoring.json", () => {
    resetScoringConfigCache();
    expect(loadScoringConfig().scoringVersion).toBe("1.0.0");
    expect(loadScoringConfig()).toBe(loadScoringConfig());
  });
});

describe("scoreUserEvidence", () => {
  beforeEach(() => {
    repoFindMock.mockReset();
    evidenceFindMock.mockReset();
    createMock.mockReset().mockResolvedValue({ _id: "analysis-1" });
  });

  function arrange() {
    repoFindMock.mockReturnValue(
      lean([
        { _id: REPO_B, scoringObservations: { sourceFileCount: 10, relevantStructureSignalCount: 1 } },
        { _id: REPO_A, scoringObservations: { sourceFileCount: 50, relevantStructureSignalCount: 5 } },
        { _id: REPO_OLD },
      ]),
    );
    evidenceFindMock.mockReturnValue(
      lean([
        evidenceDoc("e2", REPO_B, "react", "dependency", 1),
        evidenceDoc("e1", REPO_A, "react", "dependency", 1),
        evidenceDoc("e3", REPO_A, "react", "framework", 1),
        evidenceDoc("e4", REPO_A, "react", "sourceUsage", 0.5),
      ]),
    );
  }

  it("scopes every query by user and never touches repositories lacking observations", async () => {
    arrange();
    const scored = await scoreUserEvidence(USER);

    expect(repoFindMock).toHaveBeenCalledWith({ userId: USER, analyzed: true });
    expect(evidenceFindMock).toHaveBeenCalledWith({
      userId: USER,
      repositoryId: { $in: [REPO_A, REPO_B] },
    });
    expect(scored.skippedRepositoryIds).toEqual([REPO_OLD]);
    expect(scored.repositoryIds).toEqual([REPO_A, REPO_B]);
  });

  it("scores the evidence and persists a traceable analysis", async () => {
    arrange();
    const scored = await scoreUserEvidence(USER);

    expect(scored.analysisId).toBe("analysis-1");
    expect(scored.evidenceCount).toBe(4);
    expect(scored.result.skillScores).toHaveLength(1);
    expect(scored.result.skillScores[0]!.skillId).toBe("react");

    const stored = createMock.mock.calls[0]![0];
    expect(stored).toMatchObject({
      userId: USER,
      scoringVersion: "1.0.0",
      repositoryIds: [REPO_A, REPO_B],
      evidenceCount: 4,
    });
    expect(stored.scoringConfigHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.result).toBe(scored.result);

    const signals = scored.result.repositorySkillScores.find((s) => s.repositoryId === REPO_A)!.signals;
    expect(signals.find((s) => s.signal === "dependency")!.evidenceIds).toEqual(["e1"]);
  });

  it("is independent of MongoDB retrieval order", async () => {
    arrange();
    const first = await scoreUserEvidence(USER);

    repoFindMock.mockReturnValue(
      lean([
        { _id: REPO_A, scoringObservations: { sourceFileCount: 50, relevantStructureSignalCount: 5 } },
        { _id: REPO_B, scoringObservations: { sourceFileCount: 10, relevantStructureSignalCount: 1 } },
      ]),
    );
    evidenceFindMock.mockReturnValue(
      lean([
        evidenceDoc("e4", REPO_A, "react", "sourceUsage", 0.5),
        evidenceDoc("e3", REPO_A, "react", "framework", 1),
        evidenceDoc("e1", REPO_A, "react", "dependency", 1),
        evidenceDoc("e2", REPO_B, "react", "dependency", 1),
      ]),
    );
    const second = await scoreUserEvidence(USER);

    expect(second.result).toEqual(first.result);
  });

  it("fails with NO_EVIDENCE when nothing can be scored", async () => {
    repoFindMock.mockReturnValue(lean([]));
    await expect(scoreUserEvidence(USER)).rejects.toMatchObject({ code: "NO_EVIDENCE", status: 404 });
    expect(evidenceFindMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();

    repoFindMock.mockReturnValue(lean([{ _id: REPO_A, scoringObservations: { sourceFileCount: 1, relevantStructureSignalCount: 0 } }]));
    evidenceFindMock.mockReturnValue(lean([]));
    await expect(scoreUserEvidence(USER)).rejects.toMatchObject({ code: "NO_EVIDENCE" });
  });

  it("maps invalid stored evidence to INVALID_EVIDENCE without persisting", async () => {
    repoFindMock.mockReturnValue(
      lean([{ _id: REPO_A, scoringObservations: { sourceFileCount: 1, relevantStructureSignalCount: 0 } }]),
    );
    evidenceFindMock.mockReturnValue(lean([evidenceDoc("e1", REPO_A, "react", "dependency", 7)]));

    await expect(scoreUserEvidence(USER)).rejects.toMatchObject({ code: "INVALID_EVIDENCE" });
    expect(createMock).not.toHaveBeenCalled();
  });
});
