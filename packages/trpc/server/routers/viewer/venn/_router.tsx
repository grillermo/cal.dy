import authedProcedure from "../../../procedures/authedProcedure";
import { router } from "../../../trpc";
import { ZAddContactInputSchema } from "./addContact.schema";
import { ZBookInputSchema } from "./book.schema";
import { ZRemoveContactInputSchema } from "./removeContact.schema";
import { ZSearchStatusInputSchema } from "./searchStatus.schema";
import { ZStartSearchInputSchema } from "./startSearch.schema";
import { ZUpdateContactInputSchema } from "./updateContact.schema";

export const vennRouter = router({
  contacts: router({
    list: authedProcedure.query(async ({ ctx }) => {
      const { listContactsHandler } = await import("./listContacts.handler");
      return listContactsHandler({ ctx });
    }),
    add: authedProcedure.input(ZAddContactInputSchema).mutation(async ({ ctx, input }) => {
      const { addContactHandler } = await import("./addContact.handler");
      return addContactHandler({ ctx, input });
    }),
    update: authedProcedure.input(ZUpdateContactInputSchema).mutation(async ({ ctx, input }) => {
      const { updateContactHandler } = await import("./updateContact.handler");
      return updateContactHandler({ ctx, input });
    }),
    remove: authedProcedure.input(ZRemoveContactInputSchema).mutation(async ({ ctx, input }) => {
      const { removeContactHandler } = await import("./removeContact.handler");
      return removeContactHandler({ ctx, input });
    }),
  }),
  startSearch: authedProcedure.input(ZStartSearchInputSchema).mutation(async ({ ctx, input }) => {
    const { startSearchHandler } = await import("./startSearch.handler");
    return startSearchHandler({ ctx, input });
  }),
  searchStatus: authedProcedure.input(ZSearchStatusInputSchema).query(async ({ ctx, input }) => {
    const { searchStatusHandler } = await import("./searchStatus.handler");
    return searchStatusHandler({ ctx, input });
  }),
  book: authedProcedure.input(ZBookInputSchema).mutation(async ({ ctx, input }) => {
    const { bookHandler } = await import("./book.handler");
    return bookHandler({ ctx, input });
  }),
});
