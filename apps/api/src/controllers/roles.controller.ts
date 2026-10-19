import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { getGapAnalysis, getRole, listRoles, runGapAnalysis } from "../services/gap-analysis.service.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

const roleIdSchema = z.string().min(1).max(64);
const roleParamsSchema = z.object({ id: roleIdSchema });
const gapAnalysisBodySchema = z.object({ roleId: roleIdSchema }).strict();
const gapAnalysisParamsSchema = z.object({
  id: z.string().refine((value) => mongoose.isValidObjectId(value), { message: "Invalid gap analysis id." }),
});

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(AuthErrorCode.UNAUTHORIZED, 401, "Authentication required.");
  }

  return req.user;
}

function invalidRequest(): AppError {
  return new AppError(AuthErrorCode.VALIDATION_ERROR, 400, "Invalid request.");
}

export function listRolesHandler(req: Request, res: Response): void {
  requireUser(req);

  res.status(200).json({ success: true, data: listRoles() });
}

export function getRoleHandler(req: Request, res: Response): void {
  requireUser(req);
  const params = roleParamsSchema.safeParse(req.params);

  if (!params.success) {
    throw invalidRequest();
  }

  res.status(200).json({ success: true, data: getRole(params.data.id) });
}

export async function createGapAnalysisHandler(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const body = gapAnalysisBodySchema.safeParse(req.body);

  if (!body.success) {
    throw invalidRequest();
  }

  res.status(201).json({ success: true, data: await runGapAnalysis(user.id, body.data.roleId) });
}

export async function getGapAnalysisHandler(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const params = gapAnalysisParamsSchema.safeParse(req.params);

  if (!params.success) {
    throw invalidRequest();
  }

  res.status(200).json({ success: true, data: await getGapAnalysis(user.id, params.data.id) });
}
