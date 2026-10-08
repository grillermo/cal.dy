import { getVennContactService } from "@calcom/features/venn/di/VennContactService.container";
import type { TrpcSessionUser } from "../../../types";
import type { TAddContactInputSchema } from "./addContact.schema";

type Options = { ctx: { user: Pick<NonNullable<TrpcSessionUser>, "id"> }; input: TAddContactInputSchema };

export const addContactHandler = async ({ ctx, input }: Options) =>
  getVennContactService().add(ctx.user.id, input);
