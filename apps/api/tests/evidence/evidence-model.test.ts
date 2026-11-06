import { describe, expect, it } from "vitest";
import { EvidenceModel } from "../../src/models/evidence.model.js";
import { REPOSITORY_ID, USER_ID } from "./fixtures.js";

function validDocument(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    repositoryId: REPOSITORY_ID,
    skillId: "react",
    evidenceType: "DEPENDENCY",
    signal: "dependency",
    value: "react",
    normalizedStrength: 1,
    sourcePath: "package.json",
    explanation: "React is declared as a runtime dependency in package.json.",
    evidenceKey: "react|DEPENDENCY|package.json|dependency:react:runtime",
    detectedAt: new Date("2026-01-15T12:00:00.000Z"),
    ...overrides,
  };
}

describe("EvidenceModel", () => {
  it("uses the repositoryEvidence collection", () => {
    expect(EvidenceModel.collection.name).toBe("repositoryEvidence");
  });

  it("accepts a valid document with string or numeric values", async () => {
    await expect(new EvidenceModel(validDocument()).validate()).resolves.toBeUndefined();
    await expect(new EvidenceModel(validDocument({ value: 65 })).validate()).resolves.toBeUndefined();
  });

  it("rejects strengths outside [0, 1]", async () => {
    await expect(new EvidenceModel(validDocument({ normalizedStrength: 1.01 })).validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ normalizedStrength: expect.anything() }),
    });
    await expect(new EvidenceModel(validDocument({ normalizedStrength: -0.01 })).validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ normalizedStrength: expect.anything() }),
    });
  });

  it("rejects unknown evidence types and signals", async () => {
    await expect(
      new EvidenceModel(validDocument({ evidenceType: "VIBES", signal: "score" })).validate(),
    ).rejects.toMatchObject({
      errors: expect.objectContaining({
        evidenceType: expect.anything(),
        signal: expect.anything(),
      }),
    });
  });

  it("requires ownership, skill, explanation and identity", async () => {
    await expect(new EvidenceModel({}).validate()).rejects.toMatchObject({
      errors: expect.objectContaining({
        userId: expect.anything(),
        repositoryId: expect.anything(),
        skillId: expect.anything(),
        explanation: expect.anything(),
        evidenceKey: expect.anything(),
        detectedAt: expect.anything(),
        normalizedStrength: expect.anything(),
      }),
    });
  });

  it("makes provenance optional", async () => {
    const doc = validDocument();
    delete (doc as Record<string, unknown>).sourcePath;

    await expect(new EvidenceModel(doc).validate()).resolves.toBeUndefined();
  });

  it("defines the idempotency and query indexes", () => {
    const indexes = EvidenceModel.schema.indexes();

    expect(indexes).toContainEqual([
      { userId: 1, repositoryId: 1, evidenceKey: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexes).toContainEqual([{ userId: 1, skillId: 1, repositoryId: 1 }, expect.anything()]);
  });

  it("has no score or token fields", () => {
    const paths = Object.keys(EvidenceModel.schema.paths);

    expect(paths.some((path) => /score|token|rank/i.test(path))).toBe(false);
  });
});
