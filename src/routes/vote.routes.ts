import { Router } from "express";
import { createVote, getVoteStatus } from "../controllers/vote.controller";
import { validate } from "../middlewares/validate";
import { InitiateVoteSchema } from "../schemas/vote.schema";

const router = Router();

/** POST /api/votes — initiate a vote (no auth required, just a payment) */
router.post("/", validate(InitiateVoteSchema), createVote);

/** GET /api/votes/:voteId/status — check the payment status */
router.get("/:voteId/status", getVoteStatus);

export default router;
