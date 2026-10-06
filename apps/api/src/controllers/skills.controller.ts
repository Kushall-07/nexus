import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { listSkillEvidence } from "../services/evidence.service.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

const querySchema = z.object({
  repositoryId: z
    .string()
    .refine((value) => mongoose.isValidObjectId(value), { message: "Invalid repository id." })
    .optional(),
});

// Returns the authenticated user's evidence for one skill. The user is always
// taken from the session, never from the request.
export async function getSkillEvidenceHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(AuthErrorCode.UNAUTHORIZED, 401, "Authentication required.");
  }

  const params = paramsSchema.safeParse(req.params);
  const query = querySchema.safeParse(req.query);

  if (!params.success || !query.success) {
    throw new AppError(AuthErrorCode.VALIDATION_ERROR, 400, "Invalid request.");
  }

  const evidence = await listSkillEvidence(req.user.id, params.data.id, query.data.repositoryId);

  res.status(200).json({
    success: true,
    data: { skillId: params.data.id, evidence },
  });
}
