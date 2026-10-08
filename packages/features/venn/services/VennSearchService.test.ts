import { describe, expect, it, vi } from "vitest";
import { VennSearchService } from "./VennSearchService";

const NOW = new Date("2026-10-01T00:00:00Z");
const iso = (s: string) => `${s}Z`;
const result = (over: Record<string, unknown>) => ({
  id: 1,
  contactId: 1,
  status: "DONE",
  durationMinutes: 30,
  freeIntervals: [{ start: iso("2026-10-10T10:00:00"), end: iso("2026-10-10T12:00:00") }],
  error: null,
  fetchedAt: NOW,
  ...over,
});
const search = (results: unknown[]) => ({
  id: "s1",
  userId: 7,
  contactIds: [1, 2],
  windowStart: new Date("2026-10-05T00:00:00Z"),
  windowEnd: new Date("2026-10-19T00:00:00Z"),
  timeZone: "UTC",
  results,
});
const contacts = [
  { id: 1, name: "Ana", email: "a@x.com", bookingUrl: "u1", provider: "CALENDLY" },
  { id: 2, name: "Bob", email: "b@x.com", bookingUrl: "u2", provider: "CALCOM" },
];

const make = (
  s: ReturnType<typeof search> | null,
  organizer = [{ time: iso("2026-10-10T10:00:00") }, { time: iso("2026-10-10T10:30:00") }]
) => {
  const searchRepo = {
    findByIdAndUserId: vi.fn(async () => s),
    setStatus: vi.fn(),
    createSearchWithResults: vi.fn(async () => ({ id: "s1", resultIds: [11, 12] })),
    deleteOlderThan: vi.fn(async () => 0),
  };
  const contactRepo = { findManyByIdsAndUserId: vi.fn(async () => contacts) };
  let taskSeq = 0;
  const tasker = { create: vi.fn(async () => `task-${++taskSeq}`) };
  const kick = vi.fn(async (_taskIds: string[], _leasedUntil: Date) => undefined);
  const fetchSlots = vi.fn(async () => ({ slots: { "2026-10-10": organizer } }));
  const hidden = { getOrCreate: vi.fn(async () => ({ id: 99, slug: "venn-group-meeting" })) };
  const service = new VennSearchService({
    searchRepo: searchRepo as never,
    contactRepo: contactRepo as never,
    hiddenEventTypeService: hidden as never,
    tasker: tasker as never,
    kick,
    fetchSlots,
    now: () => NOW,
  });
  return { service, searchRepo, contactRepo, tasker, kick, fetchSlots };
};

describe("startSearch", () => {
  const input = {
    contactIds: [1, 2],
    windowStart: new Date("2026-10-05T00:00:00Z"),
    windowEnd: new Date("2026-10-19T00:00:00Z"),
    timeZone: "UTC",
  };

  const LEASED_UNTIL = new Date(NOW.getTime() + 3 * 60 * 1000);

  it("enqueues one leased task per contact with maxAttempts 3, then kicks exactly those tasks", async () => {
    const { service, tasker, kick } = make(null);
    expect(await service.startSearch(7, input)).toEqual({ searchId: "s1" });
    expect(tasker.create).toHaveBeenCalledTimes(2);
    expect(tasker.create).toHaveBeenCalledWith(
      "vennFetchAvailability",
      { searchResultId: 11 },
      { maxAttempts: 3, scheduledAt: LEASED_UNTIL }
    );
    expect(kick).toHaveBeenCalledTimes(1);
    expect(kick).toHaveBeenCalledWith(["task-1", "task-2"], LEASED_UNTIL);
  });

  it("does not wait for the kick to finish", async () => {
    const { service, kick } = make(null);
    kick.mockImplementation(() => new Promise<undefined>(() => {}));
    expect(await service.startSearch(7, input)).toEqual({ searchId: "s1" });
  });

  it("still returns the searchId when the kick rejects", async () => {
    const { service, kick } = make(null);
    kick.mockRejectedValueOnce(new Error("db gone"));
    expect(await service.startSearch(7, input)).toEqual({ searchId: "s1" });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("marks the search FAILED and rethrows when enqueueing fails", async () => {
    const { service, tasker, searchRepo, kick } = make(null);
    tasker.create.mockResolvedValueOnce("t1").mockRejectedValueOnce(new Error("queue down"));
    await expect(service.startSearch(7, input)).rejects.toThrow("queue down");
    expect(searchRepo.setStatus).toHaveBeenCalledWith("s1", "FAILED");
    expect(kick).not.toHaveBeenCalled();
  });

  it("still returns the searchId when kick throws", async () => {
    const { service, kick } = make(null);
    kick.mockImplementation(() => {
      throw new Error("outside request scope");
    });
    expect(await service.startSearch(7, input)).toEqual({ searchId: "s1" });
  });

  it("creates rows, then enqueues, then kicks", async () => {
    const { service, searchRepo, tasker, kick } = make(null);
    await service.startSearch(7, input);
    const order = (m: { mock: { invocationCallOrder: number[] } }) => m.mock.invocationCallOrder[0];
    expect(order(searchRepo.createSearchWithResults)).toBeLessThan(order(tasker.create));
    expect(order(tasker.create)).toBeLessThan(order(kick));
  });

  it("dedupes duplicate contact ids", async () => {
    const { service, searchRepo, contactRepo } = make(null);
    await service.startSearch(7, { ...input, contactIds: [1, 2, 2, 1] });
    expect(contactRepo.findManyByIdsAndUserId).toHaveBeenCalledWith([1, 2], 7);
    expect(searchRepo.createSearchWithResults).toHaveBeenCalledWith(
      expect.objectContaining({ contactIds: [1, 2] })
    );
  });

  it("rejects windowEnd <= windowStart", async () => {
    const { service } = make(null);
    await expect(service.startSearch(7, { ...input, windowEnd: input.windowStart })).rejects.toThrow(
      /windowEnd/
    );
  });

  it("rejects a window longer than 31 days", async () => {
    const { service } = make(null);
    await expect(
      service.startSearch(7, { ...input, windowEnd: new Date("2026-11-20T00:00:00Z") })
    ).rejects.toThrow(/31/);
  });

  it("rejects contacts that are not all owned by the user", async () => {
    const { service, contactRepo } = make(null);
    contactRepo.findManyByIdsAndUserId.mockResolvedValueOnce([contacts[0]]);
    await expect(service.startSearch(7, input)).rejects.toThrow(/contact/i);
  });

  it("rejects an empty contact list", async () => {
    const { service } = make(null);
    await expect(service.startSearch(7, { ...input, contactIds: [] })).rejects.toThrow();
  });
});

describe("searchStatus", () => {
  it("reports PENDING with per-participant status while fetching, without slots", async () => {
    const { service } = make(
      search([
        result({}),
        result({ id: 2, contactId: 2, status: "PENDING", freeIntervals: null, durationMinutes: null }),
      ])
    );
    const res = await service.searchStatus(7, { searchId: "s1" });
    expect(res.status).toBe("PENDING");
    expect(res.slots).toBeUndefined();
    expect(res.participants.map((p) => p.status)).toEqual(["DONE", "PENDING"]);
  });

  it("lets FAILED beat PENDING", async () => {
    const { service } = make(
      search([
        result({ status: "PENDING", freeIntervals: null }),
        result({ id: 2, contactId: 2, status: "FAILED", error: "boom", freeIntervals: null }),
      ])
    );
    expect((await service.searchStatus(7, { searchId: "s1" })).status).toBe("FAILED");
  });

  it("reports FAILED naming the contact and link, never dropping it", async () => {
    const { service, searchRepo } = make(
      search([
        result({}),
        result({ id: 2, contactId: 2, status: "FAILED", error: "u2: not found", freeIntervals: null }),
      ])
    );
    const res = await service.searchStatus(7, { searchId: "s1" });
    expect(res.status).toBe("FAILED");
    expect(res.participants[1]).toMatchObject({ name: "Bob", error: "u2: not found" });
    expect(searchRepo.setStatus).toHaveBeenCalledWith("s1", "FAILED");
  });

  it("reports a contact deleted after the search started as a FAILED 'Removed contact' and fails the search", async () => {
    const { service, contactRepo, searchRepo } = make(
      search([result({}), result({ id: 2, contactId: 2, status: "PENDING", freeIntervals: null })])
    );
    contactRepo.findManyByIdsAndUserId.mockResolvedValueOnce([contacts[0]]);
    const res = await service.searchStatus(7, { searchId: "s1" });
    expect(res.status).toBe("FAILED");
    expect(res.participants[1]).toEqual({
      contactId: 2,
      name: "Removed contact",
      provider: null,
      status: "FAILED",
      durationMinutes: null,
      error: "contact removed",
    });
    expect(searchRepo.setStatus).toHaveBeenCalledWith("s1", "FAILED");
  });

  it("returns default duration and the intersection with the organizer when all are done", async () => {
    const { service } = make(search([result({}), result({ id: 2, contactId: 2, durationMinutes: 60 })]));
    const res = await service.searchStatus(7, { searchId: "s1" });
    expect(res.status).toBe("DONE");
    expect(res.defaultDurationMinutes).toBe(30);
    expect(res.slots?.slots["2026-10-10"].map((s) => s.time)).toEqual([
      iso("2026-10-10T10:00:00").replace("Z", ".000Z"),
      iso("2026-10-10T10:30:00").replace("Z", ".000Z"),
    ]);
  });

  it("recomputes for a duration override without refetching contacts", async () => {
    const { service, fetchSlots } = make(search([result({}), result({ id: 2, contactId: 2 })]));
    await service.searchStatus(7, { searchId: "s1", durationMinutes: 60 });
    expect(fetchSlots).toHaveBeenCalledWith(expect.objectContaining({ duration: 60, eventTypeId: 99 }));
  });

  it("rejects a duration that is not allowed", async () => {
    const { service } = make(search([result({}), result({ id: 2, contactId: 2 })]));
    await expect(service.searchStatus(7, { searchId: "s1", durationMinutes: 33 })).rejects.toThrow(
      /duration/i
    );
  });

  it("returns no slots (not an error) when contacts have zero availability", async () => {
    const { service } = make(search([result({ freeIntervals: [] }), result({ id: 2, contactId: 2 })]));
    const res = await service.searchStatus(7, { searchId: "s1" });
    expect(res.status).toBe("DONE");
    expect(res.slots).toEqual({ slots: {} });
  });

  it("throws NOT_FOUND for a missing, foreign or cleaned-up search", async () => {
    const { service } = make(null);
    await expect(service.searchStatus(7, { searchId: "gone" })).rejects.toThrow(/not found/i);
  });
});
