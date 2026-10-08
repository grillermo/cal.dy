import { getVennSearchService } from "@calcom/features/venn/di/VennSearchService.container";
import type { TrpcSessionUser } from "../../../types";
import type { TStartSearchInputSchema } from "./startSearch.schema";

type Options = { ctx: { user: Pick<NonNullable<TrpcSessionUser>, "id"> }; input: TStartSearchInputSchema };

export const startSearchHandler = async ({ ctx, input }: Options) =>
  getVennSearchService().startSearch(ctx.user.id, input);
