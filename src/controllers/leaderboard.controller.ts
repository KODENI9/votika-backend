import type { Request, Response } from "express";
import { getLeaderboard } from "../services/leaderboard.service";
import { asyncHandler } from "../utils/ApiError";

/**
 * Leaderboard controller — public endpoint, no auth required.
 */

/** GET /api/leaderboard */
export const getLeaderboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  
  const entries = await getLeaderboard({ page, limit });
  res.json({ data: entries, count: entries.length });
});
