import { z } from "zod";

export const ZBookInputSchema = z.object({
  searchId: z.string().uuid(),
  start: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  timeZone: z.string().min(1),
});

export type TBookInputSchema = z.infer<typeof ZBookInputSchema>;
