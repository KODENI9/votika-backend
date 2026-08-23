import type { Request, Response, NextFunction } from "express";
import { moneyFusionProvider } from "../providers/payment/MoneyFusionProvider";
import type { MoneyFusionWebhookPayload } from "../providers/payment/MoneyFusionProvider";
import { processWebhook } from "../services/vote.service";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

/**
 * Webhook controller — receives and validates MoneyFusion payment callbacks.
 *
 * IMPORTANT: This route must receive the RAW body (Buffer/string) for signature
 * verification. Mount it before express.json() or use express.raw() on this route.
 */

/** POST /api/webhooks/moneyfusion */
export async function moneyFusionWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = req.body as MoneyFusionWebhookPayload;

    // MoneyFusion might send tokenPay or token
    const token = payload.tokenPay || payload.token;

    if (!token) {
      throw ApiError.badRequest("Payload webhook invalide : token manquant");
    }

    // Since we don't have a webhook signature, we MUST manually verify the payment status via GET request
    const verification = await moneyFusionProvider.verifyPayment(token);
    
    // Convert the verified status to the format processWebhook expects
    // moneyFusionProvider.verifyPayment returns "success" | "failed" | "pending" | "cancelled"
    const finalStatus =
      verification.status === "success"
        ? "SUCCESS"
        : verification.status === "cancelled"
          ? "CANCELLED"
          : "FAILED";

    if (verification.status === "pending") {
      logger.info("Paiement toujours en cours, on ignore le webhook", { token });
      res.status(200).json({ received: true, status: "pending" });
      return;
    }

    logger.info("MoneyFusion webhook received", {
      token: payload.token,
      status: payload.status,
    });

    // Process the webhook (idempotent — safe to call multiple times)
    await processWebhook(token, finalStatus, {
      ...payload,
      _verifiedStatus: verification.status, // inject the verified status
    });

    // Always acknowledge with 200 so MoneyFusion doesn't retry unnecessarily
    res.status(200).json({ received: true, processed: true });
  } catch (err) {
    next(err);
  }
}
