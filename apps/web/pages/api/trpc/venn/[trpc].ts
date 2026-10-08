import { createNextApiHandler } from "@calcom/trpc/server/createNextApiHandler";
import { vennRouter } from "@calcom/trpc/server/routers/viewer/venn/_router";

export default createNextApiHandler(vennRouter);
