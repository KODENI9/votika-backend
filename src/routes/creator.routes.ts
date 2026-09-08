import { Router } from "express";
import {
  listCreators,
  getCreator,
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  getMyStats,
} from "../controllers/creator.controller";
import { requireAuth } from "../middlewares/clerkAuth";
import { requireRole } from "../middlewares/requireRole";
import { validate } from "../middlewares/validate";
import {
  CreateCreatorSchema,
  UpdateCreatorSchema,
  ListCreatorsQuerySchema,
  CreatorIdParamSchema,
} from "../schemas/creator.schema";

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
router.get("/", validate(ListCreatorsQuerySchema, "query"), listCreators);
router.get("/:id", validate(CreatorIdParamSchema, "params"), getCreator);

// ─── Creator-scoped (must be authenticated + have role "creator") ─────────────
router.get(
  "/me",
  requireAuth,
  requireRole("creator"),
  getMyProfile
);

router.post(
  "/me",
  requireAuth,
  validate(CreateCreatorSchema),
  createMyProfile
);

router.patch(
  "/me",
  requireAuth,
  requireRole("creator"),
  validate(UpdateCreatorSchema),
  updateMyProfile
);

router.get(
  "/me/stats",
  requireAuth,
  requireRole("creator"),
  getMyStats
);

export default router;
