import { z } from "zod";

/** Allowed creator statuses */
export const CreatorStatusEnum = z.enum([
  "active",
  "paused",
  "inactive",
  "pending",
]);

/** Allowed creator categories */
export const CreatorCategoryEnum = z.enum([
  "Musicien",
  "Humoriste",
  "Entrepreneur",
  "Danseur",
  "Cuisinier",
  "Voyageur",
  "Beauté",
  "Sport",
  "Gaming",
  "Education",
  "Autre",
]);

/**
 * Schema for creating/completing a creator profile (POST /api/creators/me)
 */
export const CreateCreatorSchema = z.object({
  displayName: z.string().min(2).max(80),
  tiktokHandle: z
    .string()
    .min(1)
    .max(50)
    .regex(/^@?[\w.]+$/, "Pseudo TikTok invalide"),
  bio: z.string().max(500).default(""),
  country: z.string().min(2).max(60),
  category: CreatorCategoryEnum,
  avatarUrl: z.string().url("URL avatar invalide"),
});

/**
 * Schema for partial updates (PATCH /api/creators/me)
 */
export const UpdateCreatorSchema = CreateCreatorSchema.partial();

/**
 * Schema for admin-side creator update (PATCH /api/admin/creators/:id)
 * Allows updating status in addition to profile fields.
 */
export const AdminUpdateCreatorSchema = UpdateCreatorSchema.extend({
  status: CreatorStatusEnum.optional(),
});

/**
 * Query params for listing creators (GET /api/creators)
 */
export const ListCreatorsQuerySchema = z.object({
  category: CreatorCategoryEnum.optional(),
  country: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * URL param schema for :id routes
 */
export const CreatorIdParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateCreatorInput = z.infer<typeof CreateCreatorSchema>;
export type UpdateCreatorInput = z.infer<typeof UpdateCreatorSchema>;
export type AdminUpdateCreatorInput = z.infer<typeof AdminUpdateCreatorSchema>;
export type ListCreatorsQuery = z.infer<typeof ListCreatorsQuerySchema>;
