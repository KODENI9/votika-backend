import type { Request, Response } from "express";
import {
  listAllCreators,
  adminUpdateCreator,
  adminDeleteCreator,
  countActiveCreators,
  createCreatorProfile,
} from "../services/creator.service";
import { listTransactionsForAdmin, getDashboardRevenue } from "../services/transaction.service";
import { getSettings, updateSettings } from "../models/settings.model";
import type { AdminUpdateCreatorInput } from "../schemas/creator.schema";
import type { UpdateSettingsInput } from "../schemas/settings.schema";
import { db, Timestamp } from "../config/firebase";
import { asyncHandler } from "../utils/ApiError";
import { logger } from "../utils/logger";
/**
 * Admin controller — dashboard, creator management, transactions, settings.
 * All routes are protected by requireRole("admin") in admin.routes.ts.
 */

/** GET /api/admin/dashboard — global stats */
export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const [totalRevenue, activeCreatorCount, totalVotesSnap] = await Promise.all([
    getDashboardRevenue(),
    countActiveCreators(),
    db
      .collection("creators")
      .where("status", "==", "active")
      .select("totalVotes")
      .get(),
  ]);

  const totalVotes = totalVotesSnap.docs.reduce(
    (sum, doc) => sum + ((doc.data() as { totalVotes?: number }).totalVotes ?? 0),
    0
  );

  // 7-day revenue trend: sum successful transactions grouped by day
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentTxSnap = await db
    .collection("transactions")
    .where("status", "==", "success")
    .where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo))
    .get();

  // Group by date string (YYYY-MM-DD)
  const dailyRevenue: Record<string, number> = {};
  for (const doc of recentTxSnap.docs) {
    const data = doc.data() as { amount: number; createdAt: FirebaseFirestore.Timestamp };
    const dateKey = data.createdAt.toDate().toISOString().split("T")[0];
    dailyRevenue[dateKey] = (dailyRevenue[dateKey] ?? 0) + data.amount;
  }

  res.json({
    data: {
      totalRevenue,
      activeCreatorCount,
      totalVotes,
      trends7d: dailyRevenue,
    },
  });
});

/** POST /api/admin/creators — create a candidate profile with a generated ID */
export const createCreator = asyncHandler(async (req: Request, res: Response) => {
  const newId = require("crypto").randomUUID().replace(/-/g, "").substring(0, 21);
  const creator = await createCreatorProfile(newId, req.body);
  logger.info("Admin manually created creator", { id: newId });
  res.status(201).json({ data: creator });
});

/** GET /api/admin/creators */
export const listCreators = asyncHandler(async (req: Request, res: Response) => {
  const { category, country, search, status, page, limit } = req.query as Record<string, string>;
  const creators = await listAllCreators({
    category,
    country,
    search,
    status: status as "active" | "paused" | "inactive" | "pending" | undefined,
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });
  res.json({ data: creators, count: creators.length });
});

/** PATCH /api/admin/creators/:id */
export const updateCreator = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const creator = await adminUpdateCreator(id, req.body as AdminUpdateCreatorInput);
  logger.info("Admin updated creator", { id });
  res.json({ data: creator });
});

/** DELETE /api/admin/creators/:id */
export const deleteCreator = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await adminDeleteCreator(id);
  logger.info("Admin deleted creator", { id });
  res.json({ message: "Créateur supprimé avec succès" });
});

/** GET /api/admin/transactions */
export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await listTransactionsForAdmin(
    req.query as unknown as Parameters<typeof listTransactionsForAdmin>[0]
  );
  res.json({ data: transactions, count: transactions.length });
});

/** GET /api/admin/settings */
export const getSettingsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();
  res.json({ data: settings });
});

/** PATCH /api/admin/settings */
export const updateSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const updated = await updateSettings(req.body as UpdateSettingsInput);
  logger.info("Admin updated settings", { updated });
  res.json({ data: updated });
});
