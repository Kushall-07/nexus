import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    githubId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    username: {
      type: String,
      required: true,
      trim: true,
    },

    encryptedGithubToken: {
      type: String,
      required: true,
      select: false,
    },

    // Denormalized counter used to atomically enforce the MAX_REPOSITORIES_PER_ANALYSIS
    // limit without multi-document transactions (see github-selection.service.ts).
    selectedRepositoryCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel = model("User", userSchema);
