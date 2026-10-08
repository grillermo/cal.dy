import { z } from "zod";

export const ZRemoveContactInputSchema = z.object({ id: z.number().int() });

export type TRemoveContactInputSchema = z.infer<typeof ZRemoveContactInputSchema>;
