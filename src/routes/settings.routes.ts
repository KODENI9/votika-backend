import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/ApiError";
import { getSettings } from "../models/settings.model";

const router = Router();

/**
 * GET /api/settings
 * Public endpoint to fetch global app settings (vote price, campaign status)
 */
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await getSettings();
    res.json({
      voteUnitPrice: settings.voteUnitPrice,
      campaignActive: settings.campaignActive,
    });
  })
);

export default router;
