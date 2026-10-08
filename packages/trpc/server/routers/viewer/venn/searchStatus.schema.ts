import { z } from "zod";

export const ZSearchStatusInputSchema = z.object({
  searchId: z.string().uuid(),
  durationMinutes: z.number().int().positive().optional(),
});

export type TSearchStatusInputSchema = z.infer<typeof ZSearchStatusInputSchema>;
