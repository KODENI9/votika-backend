import type { Request, Response } from "express";
import { getLeaderboard } from "../services/leaderboard.service";
import { asyncHandler } from "../utils/ApiError";

/**
 * Leaderboard controller — public endpoint, no auth required.
 */

/** GET /api/leaderboard */
export const getLeaderboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
  const entries = await getLeaderboard({ page: Number(page), limit: Number(limit) });
  res.json({ data: entries, count: entries.length });
});
