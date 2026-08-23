import { Router } from "express";
import { createVote } from "../controllers/vote.controller";
import { validate } from "../middlewares/validate";
import { InitiateVoteSchema } from "../schemas/vote.schema";

const router = Router();

/** POST /api/votes — initiate a vote (no auth required, just a payment) */
router.post("/", validate(InitiateVoteSchema), createVote);

export default router;
