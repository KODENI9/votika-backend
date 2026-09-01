import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import {
  listActiveCreators,
  getCreatorProfile,
  createCreatorProfile,
  updateCreatorProfile,
} from "../services/creator.service";
import { getCreatorStats } from "../services/vote.service";
import type { CreateCreatorInput, UpdateCreatorInput } from "../schemas/creator.schema";
import { asyncHandler } from "../utils/ApiError";

/**
 * Creator controller — handles requests for public and creator-scoped routes.
 * Never touches Firestore directly; delegates to creator.service.
 */

/** GET /api/creators — list active creators with optional filters */
export const listCreators = asyncHandler(async (req: Request, res: Response) => {
  const { category, country, search } = req.query as {
    category?: string;
    country?: string;
    search?: string;
  };
  const pageStr = req.query.page as string | undefined;
  const limitStr = req.query.limit as string | undefined;
  
  const page = pageStr ? parseInt(pageStr, 10) : undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const creators = await listActiveCreators({ category, country, search, page, limit });
  res.json({ creators, total: creators.length });
});

/** GET /api/creators/:id — public creator profile */
export const getCreator = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const creator = await getCreatorProfile(id);
  res.json({ data: creator });
});

/** GET /api/creators/me — own profile */
export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const creator = await getCreatorProfile(userId!);
  res.json({ data: creator });
});

/** POST /api/creators/me — create own profile */
export const createMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const creator = await createCreatorProfile(userId!, req.body as CreateCreatorInput);
  res.status(201).json({ data: creator });
});

/** PATCH /api/creators/me — update own profile */
export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const creator = await updateCreatorProfile(userId!, req.body as UpdateCreatorInput);
  res.json({ data: creator });
});

/** GET /api/creators/me/stats — own statistics */
export const getMyStats = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const stats = await getCreatorStats(userId!);
  res.json({ data: stats });
});
