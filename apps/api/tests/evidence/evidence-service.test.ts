import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEvidenceKey } from "@nexus/domain";

const bulkWriteMock = vi.fn();
const deleteManyMock = vi.fn();
const findMock = vi.fn();

vi.mock("../../src/models/evidence.model.js", () => ({
  EvidenceModel: {
    bulkWrite: (...args: unknown[]) => bulkWriteMock(...args),
    deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    find: (...args: unknown[]) => findMock(...args),
  },
}));

const { buildEvidence } = await import("../../src/evidence/evidence-builder.js");
const { generateRepositoryEvidence, listSkillEvidence, replaceRepositoryEvidence, toPublicEvidence } =
  await import("../../src/services/evidence.service.js");
const { DETECTED_AT, REPOSITORY_ID, USER_ID, emptyAnalysis, richAnalysis } = await import("./fixtures.js");

function items() {
  return buildEvidence({
    userId: USER_ID,
    repositoryId: REPOSITORY_ID,
    analysis: richAnalysis(),
    detectedAt: DETECTED_AT,
  }).items;
}

describe("evidence persistence", () => {
  beforeEach(() => {
    bulkWriteMock.mockReset().mockResolvedValue({});
    deleteManyMock.mockReset().mockResolvedValue({});
    findMock.mockReset();
  });

  it("upserts each item by deterministic key, scoped to user and repository", async () => {
    const evidence = items();
    await replaceRepositoryEvidence(USER_ID, REPOSITORY_ID, evidence);

    const [operations, options] = bulkWriteMock.mock.calls[0]!;
    expect(options).toEqual({ ordered: false });
    expect(operations).toHaveLength(evidence.length);

    operations.forEach((operation: any, index: number) => {
      expect(operation.updateOne.upsert).toBe(true);
      expect(operation.updateOne.filter).toEqual({
        userId: USER_ID,
        repositoryId: REPOSITORY_ID,
        evidenceKey: buildEvidenceKey(evidence[index]!),
      });
      expect(operation.updateOne.update.$set.normalizedStrength).toBe(
        evidence[index]!.normalizedStrength,
      );
    });
  });

  it("removes stale evidence for the same user repository only", async () => {
    const evidence = items();
    await replaceRepositoryEvidence(USER_ID, REPOSITORY_ID, evidence);

    expect(deleteManyMock).toHaveBeenCalledWith({
      userId: USER_ID,
      repositoryId: REPOSITORY_ID,
      evidenceKey: { $nin: evidence.map((item) => buildEvidenceKey(item)) },
    });
  });

  it("upserts before deleting so readers never see an empty window", async () => {
    const order: string[] = [];
    bulkWriteMock.mockImplementation(async () => void order.push("upsert"));
    deleteManyMock.mockImplementation(async () => void order.push("delete"));

    await replaceRepositoryEvidence(USER_ID, REPOSITORY_ID, items());

    expect(order).toEqual(["upsert", "delete"]);
  });

  it("clears all evidence when a re-run produces none", async () => {
    await replaceRepositoryEvidence(USER_ID, REPOSITORY_ID, []);

    expect(bulkWriteMock).not.toHaveBeenCalled();
    expect(deleteManyMock).toHaveBeenCalledWith({
      userId: USER_ID,
      repositoryId: REPOSITORY_ID,
      evidenceKey: { $nin: [] },
    });
  });

  it("is idempotent: a second run issues identical writes", async () => {
    const analysis = richAnalysis();
    await generateRepositoryEvidence(USER_ID, analysis);
    await generateRepositoryEvidence(USER_ID, analysis);

    expect(bulkWriteMock.mock.calls[0]).toEqual(bulkWriteMock.mock.calls[1]);
    expect(deleteManyMock.mock.calls[0]).toEqual(deleteManyMock.mock.calls[1]);
  });

  it("unsets optional fields a re-run no longer reports, never both set and unset", async () => {
    await replaceRepositoryEvidence(USER_ID, REPOSITORY_ID, items());

    for (const operation of bulkWriteMock.mock.calls[0]![0]) {
      const { $set, $unset } = operation.updateOne.update;
      for (const field of Object.keys($unset ?? {})) {
        expect($set).not.toHaveProperty(field);
      }
    }
  });

  it("generates evidence from analysis without any GitHub access", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await generateRepositoryEvidence(USER_ID, emptyAnalysis());

    expect(result.items).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("never persists GitHub tokens or user-provided secrets", async () => {
    await generateRepositoryEvidence(USER_ID, richAnalysis());
    const serialized = JSON.stringify(bulkWriteMock.mock.calls);

    expect(serialized).not.toMatch(/gho_|accessToken|encryptedGithubToken/);
  });
});

describe("skill evidence queries", () => {
  beforeEach(() => {
    findMock.mockReset();
  });

  function stubFind(documents: unknown[]) {
    const lean = vi.fn().mockResolvedValue(documents);
    const sort = vi.fn().mockReturnValue({ lean });
    findMock.mockReturnValue({ sort });
  }

  it("always scopes the query to the requesting user", async () => {
    stubFind([]);
    await listSkillEvidence(USER_ID, "react");

    expect(findMock).toHaveBeenCalledWith({ userId: USER_ID, skillId: "react" });
  });

  it("narrows to a repository when requested", async () => {
    stubFind([]);
    await listSkillEvidence(USER_ID, "react", REPOSITORY_ID);

    expect(findMock).toHaveBeenCalledWith({
      userId: USER_ID,
      skillId: "react",
      repositoryId: REPOSITORY_ID,
    });
  });

  it("rejects an unknown skill without querying", async () => {
    await expect(listSkillEvidence(USER_ID, "cobol")).rejects.toMatchObject({
      code: "SKILL_NOT_FOUND",
      status: 404,
    });
    expect(findMock).not.toHaveBeenCalled();
  });

  it("returns the public shape without user ids or internal keys", async () => {
    stubFind([
      {
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
        detectedAt: DETECTED_AT,
      },
    ]);

    const [item] = await listSkillEvidence(USER_ID, "react");

    expect(item).toEqual({
      repositoryId: REPOSITORY_ID,
      skillId: "react",
      evidenceType: "DEPENDENCY",
      signal: "dependency",
      value: "react",
      normalizedStrength: 1,
      sourcePath: "package.json",
      explanation: "React is declared as a runtime dependency in package.json.",
      detectedAt: DETECTED_AT.toISOString(),
    });
    expect(item).not.toHaveProperty("userId");
    expect(item).not.toHaveProperty("evidenceKey");
  });

  it("toPublicEvidence omits absent optional provenance", () => {
    const [first] = items();
    const publicItem = toPublicEvidence({ ...first!, sourcePath: undefined, sourceReference: undefined });

    expect(publicItem).not.toHaveProperty("sourcePath");
    expect(publicItem).not.toHaveProperty("sourceReference");
  });
});
