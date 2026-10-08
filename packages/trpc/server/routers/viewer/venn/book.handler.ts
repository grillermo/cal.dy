import { getVennBookingService } from "@calcom/features/venn/di/VennBookingService.container";
import type { TrpcSessionUser } from "../../../types";
import type { TBookInputSchema } from "./book.schema";

type Options = {
  ctx: { user: Pick<NonNullable<TrpcSessionUser>, "id" | "name" | "email" | "username" | "locale"> };
  input: TBookInputSchema;
};

export const bookHandler = async ({ ctx, input }: Options) => {
  const { user } = ctx;
  // Organizer identity comes from the session so the client cannot book as someone else.
  const name = user.name?.trim() || user.username || user.email.split("@")[0];
  return getVennBookingService().book(user.id, {
    ...input,
    language: user.locale ?? "en",
    organizer: { name, email: user.email },
  });
};
