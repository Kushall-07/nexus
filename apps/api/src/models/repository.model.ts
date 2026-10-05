import { Schema, model, type InferSchemaType } from "mongoose";

// Normalized, structured metadata derived from the GitHub repository API response.
// This is deliberately a fixed set of fields rather than a raw GitHub payload dump.
const repositoryMetadataSchema = new Schema(
  {
    visibility: { type: String, enum: ["public"], default: "public" },
    defaultBranch: { type: String, default: null },
    isFork: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    primaryLanguage: { type: String, default: null },
    stars: { type: Number, default: 0, min: 0 },
    forks: { type: Number, default: 0, min: 0 },
    githubCreatedAt: { type: Date, default: null },
    githubUpdatedAt: { type: Date, default: null },
    githubPushedAt: { type: Date, default: null },
  },
  { _id: false },
);

const repositorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    githubId: {
      type: Number,
      required: true,
    },

    owner: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    url: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: null,
    },

    // Byte count per language, as returned by GitHub's languages endpoint.
    // Percentages are derived at response time, never stored (evidence, not a score).
    languages: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },

    selected: {
      type: Boolean,
      default: false,
      index: true,
    },

    analyzed: {
      type: Boolean,
      default: false,
      index: true,
    },

    analyzedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: repositoryMetadataSchema,
      default: () => ({}),
    },

    // Reserved for future change-detection phases; not computed in Phase 2.
    contentHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// A repository belongs to exactly one NEXUS user record; the same GitHub repository
// may be discovered independently by multiple NEXUS users, so uniqueness is scoped
// to (userId, githubId) rather than githubId alone.
repositorySchema.index({ userId: 1, githubId: 1 }, { unique: true });

export type RepositoryDocument = InferSchemaType<typeof repositorySchema>;

export const RepositoryModel = model("Repository", repositorySchema);
