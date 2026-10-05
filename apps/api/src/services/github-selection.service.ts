import { env } from "../config/env.js";
import { RepositoryModel } from "../models/repository.model.js";
import { UserModel } from "../models/user.model.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import {
  toRepositoryDTO,
  type RepositoryResponseDTO,
} from "./github-repository.service.js";

// NEXUS enforces MAX_REPOSITORIES_PER_ANALYSIS without MongoDB multi-document
// transactions (not guaranteed to be available on a standalone deployment).
// Instead it uses a "reserve, then commit, then compensate on failure" pattern
// built entirely from atomic single-document updates, which MongoDB always
// serializes correctly even under concurrent requests:
//
//   1. Atomically increment the user's selectedRepositoryCount, but only if it
//      is still below the limit (the filter and the increment happen in one
//      atomic operation, so two concurrent requests can never both succeed
//      past the limit).
//   2. If the reservation succeeded, atomically flip the target repository's
//      `selected` flag from false to true.
//   3. If step 2 fails (e.g. a concurrent request already selected the same
//      repository), release the reservation from step 1 and resolve
//      idempotently from the repository's current state.
//
// This is weaker than a true ACID transaction across both documents, but it
// is sufficient to guarantee the invariant that actually matters: the number
// of selected repositories for a user never exceeds the configured maximum.
export async function setRepositorySelection(
  userId: string,
  repositoryId: string,
  selected: boolean,
): Promise<RepositoryResponseDTO> {
  const repo = await RepositoryModel.findOne({ _id: repositoryId, userId });

  if (!repo) {
    throw new AppError(
      AuthErrorCode.REPOSITORY_NOT_FOUND,
      404,
      "Repository not found.",
    );
  }

  if (repo.selected === selected) {
    return toRepositoryDTO(repo);
  }

  if (selected) {
    return selectRepository(userId, repositoryId);
  }

  return deselectRepository(userId, repositoryId, repo);
}

type RepositoryHydratedDocument = NonNullable<
  Awaited<ReturnType<typeof RepositoryModel.findOne>>
>;

async function selectRepository(
  userId: string,
  repositoryId: string,
) {
  const reserved = await UserModel.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lt: [
          { $ifNull: ["$selectedRepositoryCount", 0] },
          env.MAX_REPOSITORIES_PER_ANALYSIS,
        ],
      },
    },
    [
      {
        $set: {
          selectedRepositoryCount: {
            $add: [{ $ifNull: ["$selectedRepositoryCount", 0] }, 1],
          },
        },
      },
    ],
  );

  if (!reserved) {
    throw new AppError(
      AuthErrorCode.INVALID_REPOSITORY_SELECTION,
      400,
      `Cannot select more than ${env.MAX_REPOSITORIES_PER_ANALYSIS} repositories.`,
    );
  }

  const updated = await RepositoryModel.findOneAndUpdate(
    { _id: repositoryId, userId, selected: false },
    { $set: { selected: true } },
    { new: true },
  );

  if (updated) {
    return toRepositoryDTO(updated);
  }

  // The reservation succeeded but the repository was already selected by a
  // concurrent request. Release the slot we reserved and resolve from the
  // repository's actual current state instead of double-counting it.
  await releaseSelectionSlot(userId);

  const current = await RepositoryModel.findOne({ _id: repositoryId, userId });

  if (current) {
    return toRepositoryDTO(current);
  }

  throw new AppError(
    AuthErrorCode.REPOSITORY_NOT_FOUND,
    404,
    "Repository not found.",
  );
}

async function deselectRepository(
  userId: string,
  repositoryId: string,
  fallback: RepositoryHydratedDocument,
) {
  const updated = await RepositoryModel.findOneAndUpdate(
    { _id: repositoryId, userId, selected: true },
    { $set: { selected: false } },
    { new: true },
  );

  if (updated) {
    await releaseSelectionSlot(userId);
    return toRepositoryDTO(updated);
  }

  return toRepositoryDTO(fallback);
}

async function releaseSelectionSlot(userId: string): Promise<void> {
  await UserModel.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $gt: [{ $ifNull: ["$selectedRepositoryCount", 0] }, 0] },
    },
    [
      {
        $set: {
          selectedRepositoryCount: {
            $subtract: [{ $ifNull: ["$selectedRepositoryCount", 0] }, 1],
          },
        },
      },
    ],
  );
}
