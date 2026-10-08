import { getVennSearchService } from "@calcom/features/venn/di/VennSearchService.container";
import type { TrpcSessionUser } from "../../../types";
import type { TSearchStatusInputSchema } from "./searchStatus.schema";

type Options = { ctx: { user: Pick<NonNullable<TrpcSessionUser>, "id"> }; input: TSearchStatusInputSchema };

export const searchStatusHandler = async ({ ctx, input }: Options) =>
  getVennSearchService().searchStatus(ctx.user.id, input);
