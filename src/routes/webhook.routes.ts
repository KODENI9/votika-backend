import { Router } from "express";
import { moneyFusionWebhook } from "../controllers/webhook.controller";
import { asyncHandler } from "../utils/ApiError";

const router = Router();

/**
 * POST /api/webhooks/moneyfusion
 * Receives payment status callbacks from MoneyFusion.
 * No auth required — secured by HMAC signature validation in the controller.
 */
router.post("/moneyfusion", asyncHandler(moneyFusionWebhook));

export default router;
