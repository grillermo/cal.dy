import { z } from "zod";
import { isValidTimeZone } from "./timeZone";

export const ZBookInputSchema = z.object({
  searchId: z.string().uuid(),
  start: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  timeZone: z.string().min(1).refine(isValidTimeZone, { message: "Invalid time zone" }),
});

export type TBookInputSchema = z.infer<typeof ZBookInputSchema>;
