import { Router } from "express";
import creatorRoutes from "./creator.routes";
import voteRoutes from "./vote.routes";
import adminRoutes from "./admin.routes";
import leaderboardRoutes from "./leaderboard.routes";
import webhookRoutes from "./webhook.routes";
import settingsRoutes from "./settings.routes";

const router = Router();

/** Health check — no auth */
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/creators", creatorRoutes);
router.use("/votes", voteRoutes);
router.use("/admin", adminRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/settings", settingsRoutes);

export default router;
