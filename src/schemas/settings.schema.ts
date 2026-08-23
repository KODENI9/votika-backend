import { z } from "zod";

/**
 * Schema for updating application settings (PATCH /api/admin/settings)
 */
export const UpdateSettingsSchema = z.object({
  voteUnitPrice: z
    .number()
    .int()
    .positive("Le prix d'un vote doit être positif")
    .optional(),
  campaignActive: z.boolean().optional(),
  campaignStartDate: z.string().datetime().nullable().optional(),
  campaignEndDate: z.string().datetime().nullable().optional(),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
