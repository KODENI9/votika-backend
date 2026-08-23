import { Router } from "express";
import { getLeaderboardHandler } from "../controllers/leaderboard.controller";
import { validate } from "../middlewares/validate";
import { LeaderboardQuerySchema } from "../schemas/vote.schema";

const router = Router();

/** GET /api/leaderboard */
router.get(
  "/",
  validate(LeaderboardQuerySchema, "query"),
  getLeaderboardHandler
);

export default router;
