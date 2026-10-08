import { getVennContactService } from "@calcom/features/venn/di/VennContactService.container";
import type { TrpcSessionUser } from "../../../types";

type Options = { ctx: { user: Pick<NonNullable<TrpcSessionUser>, "id"> } };

export const listContactsHandler = async ({ ctx }: Options) => getVennContactService().list(ctx.user.id);
