import { Schema, model, type InferSchemaType } from "mongoose";
import { EVIDENCE_TYPES, SIGNAL_TYPES } from "@nexus/domain";

// Persisted Phase 4 EvidenceItems ("repositoryEvidence"). Each document
// states that one observable repository artifact supports one skill. It
// stores no GitHub token and no score: `normalizedStrength` is the strength of
// this single piece of evidence, not a skill score.
const evidenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    skillId: { type: String, required: true },

    evidenceType: { type: String, enum: EVIDENCE_TYPES, required: true },
    signal: { type: String, enum: SIGNAL_TYPES, required: true },

    // Observed value: a name for categorical evidence, a count/percentage otherwise.
    value: { type: Schema.Types.Mixed, required: true },
    normalizedStrength: { type: Number, required: true, min: 0, max: 1 },

    sourcePath: { type: String },
    sourceReference: { type: String },
    explanation: { type: String, required: true },

    // Deterministic identity within (userId, repositoryId); see buildEvidenceKey.
    evidenceKey: { type: String, required: true },

    detectedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: "repositoryEvidence",
  },
);

// Idempotency: one document per observation identity per user repository.
// Also serves "all evidence for this user's repository".
evidenceSchema.index({ userId: 1, repositoryId: 1, evidenceKey: 1 }, { unique: true });

// "All evidence for this user's skill", optionally narrowed to a repository.
evidenceSchema.index({ userId: 1, skillId: 1, repositoryId: 1 });

export type EvidenceDocument = InferSchemaType<typeof evidenceSchema>;

export const EvidenceModel = model("RepositoryEvidence", evidenceSchema);
