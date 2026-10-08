import { z } from "zod";
import { isValidTimeZone } from "./timeZone";

export const ZStartSearchInputSchema = z
  .object({
    contactIds: z.array(z.number().int()).min(1).max(50),
    windowStart: z.coerce.date(),
    windowEnd: z.coerce.date(),
    timeZone: z.string().min(1).refine(isValidTimeZone, { message: "Invalid time zone" }),
  })
  .refine((input) => input.windowEnd.getTime() > input.windowStart.getTime(), {
    message: "windowEnd must be after windowStart",
    path: ["windowEnd"],
  });

export type TStartSearchInputSchema = z.infer<typeof ZStartSearchInputSchema>;
