import { z } from "zod";
import { ZAddContactInputSchema } from "./addContact.schema";

export const ZUpdateContactInputSchema = ZAddContactInputSchema.extend({ id: z.number().int() });

export type TUpdateContactInputSchema = z.infer<typeof ZUpdateContactInputSchema>;
