import { getVennContactService } from "@calcom/features/venn/di/VennContactService.container";
import type { TrpcSessionUser } from "../../../types";
import type { TRemoveContactInputSchema } from "./removeContact.schema";

type Options = { ctx: { user: Pick<NonNullable<TrpcSessionUser>, "id"> }; input: TRemoveContactInputSchema };

export const removeContactHandler = async ({ ctx, input }: Options) =>
  getVennContactService().remove(ctx.user.id, input.id);
