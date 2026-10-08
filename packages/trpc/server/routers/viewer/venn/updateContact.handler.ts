import { getVennContactService } from "@calcom/features/venn/di/VennContactService.container";
import type { TrpcSessionUser } from "../../../types";
import type { TUpdateContactInputSchema } from "./updateContact.schema";

type Options = { ctx: { user: Pick<NonNullable<TrpcSessionUser>, "id"> }; input: TUpdateContactInputSchema };

export const updateContactHandler = async ({ ctx, input }: Options) => {
  const { id, ...data } = input;
  return getVennContactService().update(ctx.user.id, id, data);
};
