import { z } from "zod";

/** Mobile Money payment methods supported by MoneyFusion */
export const PaymentMethodEnum = z.enum([
  "orange",
  "wave",
  "mtn",
  "flooz",
  "mix_by_yas",
]);

/**
 * Schema for initiating a vote (POST /api/votes)
 * The voter does NOT need a Clerk account.
 */
export const InitiateVoteSchema = z.object({
  creatorId: z.string().min(1, "creatorId requis"),
  voteCount: z
    .number()
    .int()
    .positive()
    .max(10_000, "Maximum 10 000 votes par transaction"),
  voterPhone: z
    .string()
    .optional()
    .default("00000000"),
  voterName: z.string().min(1).max(80).optional(),
  paymentMethod: PaymentMethodEnum.optional().default("orange"),
});

/**
 * Query params for admin transaction list
 */
export const ListTransactionsQuerySchema = z.object({
  status: z
    .enum(["pending", "success", "failed", "cancelled"])
    .optional(),
  creatorId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Query params for leaderboard (GET /api/leaderboard)
 */
export const LeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type InitiateVoteInput = z.infer<typeof InitiateVoteSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
