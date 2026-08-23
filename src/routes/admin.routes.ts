import { Router } from "express";
import {
  getDashboard,
  listCreators,
  createCreator,
  updateCreator,
  deleteCreator,
  listTransactions,
  getSettingsHandler,
  updateSettingsHandler,
} from "../controllers/admin.controller";
import { requireAuth } from "../middlewares/clerkAuth";
import { requireRole } from "../middlewares/requireRole";
import { validate } from "../middlewares/validate";
import { AdminUpdateCreatorSchema, CreateCreatorSchema } from "../schemas/creator.schema";
import { ListTransactionsQuerySchema } from "../schemas/vote.schema";
import { UpdateSettingsSchema } from "../schemas/settings.schema";

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireRole("admin"));

router.get("/dashboard", getDashboard);

router.get("/creators", listCreators);
router.post("/creators", validate(CreateCreatorSchema), createCreator);
router.patch("/creators/:id", validate(AdminUpdateCreatorSchema), updateCreator);
router.delete("/creators/:id", deleteCreator);

router.get(
  "/transactions",
  validate(ListTransactionsQuerySchema, "query"),
  listTransactions
);

router.get("/settings", getSettingsHandler);
router.patch("/settings", validate(UpdateSettingsSchema), updateSettingsHandler);

export default router;
