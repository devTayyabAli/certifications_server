import { z } from "zod";

export const updateSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  onChainVerificationPrivacy: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
