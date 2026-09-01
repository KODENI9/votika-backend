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

// Moneyfusion may ping the webhook URL with a GET request
router.get("/moneyfusion", (_req, res) => {
  res.status(200).send("Webhook endpoint is active");
});

export default router;
