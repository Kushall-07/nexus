import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { getDecryptedGithubToken } from "../services/github-token.service.js";
import {
  discoverPublicRepositories,
  getRepositoryDetail,
  listRepositoriesForUser,
  persistDiscoveredRepositories,
  toRepositoryDTO,
} from "../services/github-repository.service.js";
import { getGithubQuota } from "../services/github-quota.service.js";
import { setRepositorySelection } from "../services/github-selection.service.js";

const repositoryIdParamSchema = z.object({
  id: z.string().refine((value) => mongoose.isValidObjectId(value), {
    message: "Invalid repository id.",
  }),
});

const selectionBodySchema = z
  .object({ selected: z.boolean() })
  .strict();

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(
      AuthErrorCode.UNAUTHORIZED,
      401,
      "Authentication required.",
    );
  }

  return req.user;
}

// Discovery and analysis are separate concepts: this endpoint only discovers
// and persists repository metadata. It never fetches languages, trees, or any
// other per-repository data, so it never spends more than DISCOVERY_MAX_PAGES
// GitHub requests regardless of how many repositories the account has.
export async function listRepositories(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const accessToken = await getDecryptedGithubToken(user.id);

  const { repositories, truncated } = await discoverPublicRepositories(accessToken);
  await persistDiscoveredRepositories(user.id, repositories);

  const stored = await listRepositoriesForUser(user.id);

  res.status(200).json({
    success: true,
    data: {
      repositories: stored.map(toRepositoryDTO),
      count: stored.length,
      truncated,
    },
  });
}

export async function getRepository(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const parseResult = repositoryIdParamSchema.safeParse(req.params);

  if (!parseResult.success) {
    throw new AppError(
      AuthErrorCode.VALIDATION_ERROR,
      400,
      "Invalid repository id.",
    );
  }

  const accessToken = await getDecryptedGithubToken(user.id);
  const repo = await getRepositoryDetail(user.id, parseResult.data.id, accessToken);

  res.status(200).json({ success: true, data: toRepositoryDTO(repo) });
}

export async function getQuota(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const accessToken = await getDecryptedGithubToken(user.id);
  const quota = await getGithubQuota(accessToken);

  res.status(200).json({ success: true, data: quota });
}

export async function updateRepositorySelection(
  req: Request,
  res: Response,
): Promise<void> {
  const user = requireUser(req);

  const paramsResult = repositoryIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    throw new AppError(
      AuthErrorCode.VALIDATION_ERROR,
      400,
      "Invalid repository id.",
    );
  }

  const bodyResult = selectionBodySchema.safeParse(req.body);

  if (!bodyResult.success) {
    throw new AppError(
      AuthErrorCode.VALIDATION_ERROR,
      400,
      "Request body must be exactly { selected: boolean }.",
    );
  }

  const updated = await setRepositorySelection(
    user.id,
    paramsResult.data.id,
    bodyResult.data.selected,
  );

  res.status(200).json({ success: true, data: updated });
}
