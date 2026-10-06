import { describe, expect, it } from "vitest";
import {
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_SIGNAL,
  SIGNAL_TYPES,
  buildEvidenceKey,
  evidenceItemSchema,
} from "../src/index.js";

const valid = {
  userId: "u1",
  repositoryId: "r1",
  skillId: "react",
  evidenceType: "DEPENDENCY",
  signal: "dependency",
  value: "react",
  normalizedStrength: 1,
  sourcePath: "package.json",
  explanation: "React is declared as a runtime dependency in package.json.",
  detectedAt: new Date("2026-01-01T00:00:00Z"),
  observationKey: "dependency:react:runtime",
};

describe("evidence domain", () => {
  it("defines the canonical evidence types and signals", () => {
    expect([...EVIDENCE_TYPES]).toEqual([
      "DEPENDENCY", "LANGUAGE", "FRAMEWORK", "SOURCE_FILE", "PROJECT_STRUCTURE",
      "DOCKER", "TEST", "README", "COMMIT_ACTIVITY",
    ]);
    expect([...SIGNAL_TYPES]).toEqual([
      "dependency", "framework", "sourceUsage", "projectStructure", "testing", "documentation", "activity",
    ]);
  });

  it("maps every evidence type to a valid signal", () => {
    for (const type of EVIDENCE_TYPES) {
      expect(SIGNAL_TYPES).toContain(EVIDENCE_TYPE_SIGNAL[type]);
    }
    expect(EVIDENCE_TYPE_SIGNAL.SOURCE_FILE).toBe("sourceUsage");
    expect(EVIDENCE_TYPE_SIGNAL.TEST).toBe("testing");
    expect(EVIDENCE_TYPE_SIGNAL.README).toBe("documentation");
    expect(EVIDENCE_TYPE_SIGNAL.COMMIT_ACTIVITY).toBe("activity");
  });

  it("accepts a valid evidence item", () => {
    expect(evidenceItemSchema.safeParse(valid).success).toBe(true);
    expect(evidenceItemSchema.safeParse({ ...valid, value: 42.5 }).success).toBe(true);
  });

  it("rejects strengths outside [0, 1] and non-finite values", () => {
    for (const normalizedStrength of [-0.001, 1.001, Number.NaN, Infinity]) {
      expect(evidenceItemSchema.safeParse({ ...valid, normalizedStrength }).success).toBe(false);
    }
    expect(evidenceItemSchema.safeParse({ ...valid, value: Number.NaN }).success).toBe(false);
  });

  it("rejects a signal that does not match the evidence type", () => {
    expect(evidenceItemSchema.safeParse({ ...valid, signal: "testing" }).success).toBe(false);
  });

  it("requires a skill, an explanation and valid types", () => {
    expect(evidenceItemSchema.safeParse({ ...valid, skillId: "" }).success).toBe(false);
    expect(evidenceItemSchema.safeParse({ ...valid, explanation: "" }).success).toBe(false);
    expect(evidenceItemSchema.safeParse({ ...valid, evidenceType: "OTHER" }).success).toBe(false);
  });

  it("builds deterministic keys that ignore timestamps and strengths", () => {
    const a = buildEvidenceKey(valid as never);
    const b = buildEvidenceKey({ ...valid, detectedAt: new Date(), normalizedStrength: 0.2 } as never);

    expect(a).toBe(b);
    expect(a).toBe("react|DEPENDENCY|package.json|dependency:react:runtime");
  });

  it("distinguishes keys by skill, type, source and observation", () => {
    const base = buildEvidenceKey(valid as never);

    expect(buildEvidenceKey({ ...valid, skillId: "nextjs" } as never)).not.toBe(base);
    expect(buildEvidenceKey({ ...valid, evidenceType: "FRAMEWORK" } as never)).not.toBe(base);
    expect(buildEvidenceKey({ ...valid, sourcePath: "apps/web/package.json" } as never)).not.toBe(base);
    expect(buildEvidenceKey({ ...valid, observationKey: "other" } as never)).not.toBe(base);
    expect(buildEvidenceKey({ ...valid, sourcePath: undefined } as never)).toBe(
      "react|DEPENDENCY||dependency:react:runtime",
    );
  });
});
