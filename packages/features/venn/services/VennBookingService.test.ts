import { ErrorCode } from "@calcom/lib/errorCodes";
import { describe, expect, it, vi } from "vitest";
import { VennBookingService } from "./VennBookingService";

const NOW = new Date("2026-10-10T00:00:00Z");
const contacts = [
  { id: 1, name: "Ana", email: "ana@x.com", bookingUrl: "u1", provider: "CALENDLY" },
  { id: 2, name: "Bob", email: "BOB@x.com", bookingUrl: "u2", provider: "CALCOM" },
  { id: 3, name: "Bob again", email: "bob@x.com", bookingUrl: "u3", provider: "CALCOM" },
  { id: 4, name: "Me", email: "me@x.com", bookingUrl: "u4", provider: "LOCAL" },
];
const doneSearch = (fetchedAt: Date, status = "DONE") => ({
  id: "s1",
  userId: 7,
  contactIds: [1, 2, 3, 4],
  windowStart: NOW,
  windowEnd: new Date("2026-10-24T00:00:00Z"),
  timeZone: "UTC",
  results: [1, 2, 3, 4].map((contactId) => ({
    id: contactId,
    contactId,
    status,
    durationMinutes: 30,
    freeIntervals: [],
    error: null,
    fetchedAt,
  })),
});
const make = (search: unknown, slots = ["2026-10-12T10:00:00.000Z"], contactRows = contacts) => {
  const deps = {
    searchRepo: { findByIdAndUserId: vi.fn(async () => search) },
    contactRepo: { findManyByIdsAndUserId: vi.fn(async () => contactRows) },
    hiddenEventTypeService: { getOrCreate: vi.fn(async () => ({ id: 99, slug: "venn-group-meeting" })) },
    searchService: {
      computeCandidateSlots: vi.fn(async () => ({
        slots: { "2026-10-12": slots.map((time) => ({ time })) },
      })),
    },
    createBooking: vi.fn(async () => ({ uid: "booking-uid" })),
    now: () => new Date(NOW.getTime() + 60_000),
  };
  return { deps, service: new VennBookingService(deps as never) };
};
const input = {
  searchId: "s1",
  start: "2026-10-12T10:00:00.000Z",
  durationMinutes: 30,
  title: "Sync",
  timeZone: "UTC",
  language: "en",
  organizer: { name: "Me", email: "me@x.com" },
};

describe("VennBookingService.book", () => {
  it("books against the hidden event type with first contact as attendee and the rest as guests, deduped and without the organizer", async () => {
    const { service, deps } = make(doneSearch(NOW));
    expect(await service.book(7, input)).toEqual({ uid: "booking-uid" });
    const arg = deps.createBooking.mock.calls[0][0];
    expect(arg.bookingData).toMatchObject({
      eventTypeId: 99,
      start: input.start,
      end: "2026-10-12T10:30:00.000Z",
      responses: { name: "Ana", email: "ana@x.com", guests: ["bob@x.com"], venn_title: "Sync" },
    });
    expect(arg.bookingMeta).toMatchObject({
      userId: 7,
      skipAvailabilityCheck: true,
      skipEventLimitsCheck: false,
    });
  });

  it("uses the contacts in the order they were selected for the search", async () => {
    const { service, deps } = make(doneSearch(NOW), undefined, [...contacts].reverse());
    await service.book(7, input);
    expect(deps.createBooking.mock.calls[0][0].bookingData.responses).toMatchObject({
      email: "ana@x.com",
      guests: ["bob@x.com"],
    });
  });

  it("falls back to the default title when the title is blank", async () => {
    const { service, deps } = make(doneSearch(NOW));
    await service.book(7, { ...input, title: "   " });
    expect(deps.createBooking.mock.calls[0][0].bookingData.responses.venn_title).toBe("Group Meeting");
  });

  it("returns SEARCH_STALE when the oldest fetch is older than 5 minutes", async () => {
    const { service, deps } = make(doneSearch(new Date(NOW.getTime() - 6 * 60_000)));
    await expect(service.book(7, input)).rejects.toMatchObject({ code: ErrorCode.VennSearchStale });
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("returns SLOT_TAKEN when the start is not among the recomputed candidates", async () => {
    const { service, deps } = make(doneSearch(NOW), ["2026-10-12T11:00:00.000Z"]);
    await expect(service.book(7, input)).rejects.toMatchObject({ code: ErrorCode.VennSlotTaken });
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("rejects a search that is not DONE", async () => {
    const { service } = make(doneSearch(NOW, "PENDING"));
    await expect(service.book(7, input)).rejects.toThrow(/not ready|done/i);
  });

  it("rejects when only the organizer is left as an attendee", async () => {
    const { service, deps } = make({ ...doneSearch(NOW), contactIds: [4] }, undefined, [contacts[3]]);
    await expect(service.book(7, input)).rejects.toThrow(/no attendees/i);
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("rejects instead of silently dropping a contact deleted after the search started", async () => {
    const { service, deps } = make(doneSearch(NOW), undefined, contacts.slice(0, 3));
    await expect(service.book(7, input)).rejects.toMatchObject({
      code: ErrorCode.BadRequest,
      message: expect.stringMatching(/removed/i),
    });
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("throws NotFound for a search the user does not own", async () => {
    const { service } = make(null);
    await expect(service.book(7, input)).rejects.toThrow(/not found/i);
  });
});
