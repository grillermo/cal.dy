import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorFormatter } from "../../../errorFormatter";
import { createCallerFactory } from "../../../trpc";
import { vennRouter } from "./_router";
import { ZStartSearchInputSchema } from "./startSearch.schema";

const contactService = {
  list: vi.fn(async () => []),
  add: vi.fn(async () => ({ id: 1 })),
  update: vi.fn(async () => ({ id: 1 })),
  remove: vi.fn(async () => undefined),
};
const searchService = {
  startSearch: vi.fn(async () => ({ searchId: "s" })),
  searchStatus: vi.fn(async () => ({ status: "PENDING" })),
};
const bookingService = { book: vi.fn(async () => ({ uid: "u" })) };

vi.mock("@calcom/features/venn/di/VennContactService.container", () => ({
  getVennContactService: () => contactService,
}));
vi.mock("@calcom/features/venn/di/VennSearchService.container", () => ({
  getVennSearchService: () => searchService,
}));
vi.mock("@calcom/features/venn/di/VennBookingService.container", () => ({
  getVennBookingService: () => bookingService,
}));
vi.mock("@calcom/features/auth/lib/userFromSessionUtils", () => ({
  getUserSession: async (ctx: { user?: unknown; session?: unknown }) => ({
    user: ctx.user,
    session: ctx.session,
  }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn() }));

const user = { id: 7, name: "Me", email: "me@x.com", username: "me", locale: "en" };
const createCaller = createCallerFactory(vennRouter);
const authed = (u: Record<string, unknown> = user) =>
  createCaller({ user: u, session: { user: u } } as never);

const searchId = "6f1c1c0e-8a43-4f6d-9d3b-2f5b8a1c7e11";
const bookInput = {
  searchId,
  start: "2030-01-01T10:00:00.000Z",
  durationMinutes: 30,
  title: "Group Meeting",
  timeZone: "UTC",
};

beforeEach(() => vi.clearAllMocks());

describe("venn router", () => {
  it("rejects unauthenticated callers", async () => {
    await expect(createCaller({} as never).contacts.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(contactService.list).not.toHaveBeenCalled();
  });

  it("scopes contact procedures to ctx.user.id", async () => {
    const caller = authed();
    await caller.contacts.list();
    await caller.contacts.add({ name: "A", email: "a@x.com", bookingUrl: "https://cal.com/a/b" });
    await caller.contacts.update({ id: 3, name: "A", email: "a@x.com", bookingUrl: "https://cal.com/a/b" });
    await caller.contacts.remove({ id: 3 });
    expect(contactService.list).toHaveBeenCalledWith(7);
    expect(contactService.add).toHaveBeenCalledWith(7, expect.objectContaining({ name: "A" }));
    expect(contactService.update).toHaveBeenCalledWith(7, 3, {
      name: "A",
      email: "a@x.com",
      bookingUrl: "https://cal.com/a/b",
    });
    expect(contactService.remove).toHaveBeenCalledWith(7, 3);
  });

  it("scopes search procedures to ctx.user.id", async () => {
    const caller = authed();
    await caller.startSearch({
      contactIds: [1],
      windowStart: new Date("2030-01-01T00:00:00Z"),
      windowEnd: new Date("2030-01-05T00:00:00Z"),
      timeZone: "America/Mexico_City",
    });
    await caller.searchStatus({ searchId, durationMinutes: 45 });
    expect(searchService.startSearch).toHaveBeenCalledWith(7, expect.objectContaining({ contactIds: [1] }));
    expect(searchService.searchStatus).toHaveBeenCalledWith(7, { searchId, durationMinutes: 45 });
  });

  it("book derives organizer and language from ctx.user, not input", async () => {
    await authed({ ...user, locale: "es" }).book({
      ...bookInput,
      organizer: { name: "Evil", email: "evil@x.com" },
      language: "xx",
    } as never);
    expect(bookingService.book).toHaveBeenCalledWith(7, {
      ...bookInput,
      language: "es",
      organizer: { name: "Me", email: "me@x.com" },
    });
  });

  it("book falls back to username, then email local part, when name is null", async () => {
    await authed({ ...user, name: null }).book(bookInput);
    expect(bookingService.book).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ organizer: { name: "me", email: "me@x.com" } })
    );
    await authed({ ...user, name: " ", username: null }).book(bookInput);
    expect(bookingService.book).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ organizer: { name: "me", email: "me@x.com" } })
    );
  });

  it.each([
    [ErrorCode.VennSlotTaken, "That time is no longer available"],
    [ErrorCode.VennSearchStale, "The availability data is out of date"],
  ])("surfaces %s as CONFLICT with the cause code", async (code, message) => {
    bookingService.book.mockRejectedValueOnce(new ErrorWithCode(code, message));
    const error = await authed()
      .book(bookInput)
      .then(
        () => null,
        (e) => e
      );
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe(message);
    expect(error.cause).toBeInstanceOf(ErrorWithCode);
    expect(error.cause.code).toBe(code);
    const shape = errorFormatter({
      shape: { message, code: 409, data: { code: "CONFLICT", httpStatus: 409 } },
      error,
      type: "mutation",
      path: "venn.book",
      input: bookInput,
      ctx: {},
    });
    expect(shape.data.errorCode).toBe(code);
  });
});

describe("ZStartSearchInputSchema", () => {
  const base = {
    contactIds: [1],
    windowStart: "2030-01-01T00:00:00Z",
    windowEnd: "2030-01-05T00:00:00Z",
    timeZone: "UTC",
  };
  it("accepts a valid input", () => expect(ZStartSearchInputSchema.safeParse(base).success).toBe(true));
  it("rejects invalid dates", () =>
    expect(ZStartSearchInputSchema.safeParse({ ...base, windowStart: "nope" }).success).toBe(false));
  it("rejects an unknown time zone", () =>
    expect(ZStartSearchInputSchema.safeParse({ ...base, timeZone: "Mars/Base" }).success).toBe(false));
  it("rejects windowEnd <= windowStart", () => {
    expect(ZStartSearchInputSchema.safeParse({ ...base, windowEnd: base.windowStart }).success).toBe(false);
    expect(ZStartSearchInputSchema.safeParse({ ...base, windowEnd: "2029-01-01T00:00:00Z" }).success).toBe(
      false
    );
  });
});
