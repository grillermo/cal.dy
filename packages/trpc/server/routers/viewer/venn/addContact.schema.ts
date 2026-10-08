import { z } from "zod";

export const ZAddContactInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  bookingUrl: z.string().min(1),
});

export type TAddContactInputSchema = z.infer<typeof ZAddContactInputSchema>;
