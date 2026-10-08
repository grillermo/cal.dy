import { z } from "zod";

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const ZStartSearchInputSchema = z
  .object({
    contactIds: z.array(z.number().int()).min(1),
    windowStart: z.coerce.date(),
    windowEnd: z.coerce.date(),
    timeZone: z.string().min(1).refine(isValidTimeZone, { message: "Invalid time zone" }),
  })
  .refine((input) => input.windowEnd.getTime() > input.windowStart.getTime(), {
    message: "windowEnd must be after windowStart",
    path: ["windowEnd"],
  });

export type TStartSearchInputSchema = z.infer<typeof ZStartSearchInputSchema>;
