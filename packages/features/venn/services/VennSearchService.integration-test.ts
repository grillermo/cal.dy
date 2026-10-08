import prisma from "@calcom/prisma";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { VennContactRepository } from "../repositories/VennContactRepository";
import { VennSearchRepository } from "../repositories/VennSearchRepository";
import { VennFetchAvailabilityService } from "./VennFetchAvailabilityService";
import { VennSearchService } from "./VennSearchService";

const NOW = new Date("2026-10-01T00:00:00Z");
const stamp = Date.now();
const userIds: number[] = [];

const createUser = async (suffix: string) => {
  const user = await prisma.user.create({
    data: { email: `venn-test-${stamp}-${suffix}@example.com`, username: `venn-test-${stamp}-${suffix}` },
    select: { id: true },
  });
  userIds.push(user.id);
  return user.id;
};

const makeService = () => {
  const tasker = { create: vi.fn(async () => "task") };
  const searchRepo = new VennSearchRepository(prisma);
  const contactRepo = new VennContactRepository(prisma);
  const service = new VennSearchService({
    searchRepo,
    contactRepo,
    hiddenEventTypeService: { getOrCreate: async () => ({ id: 1, slug: "venn-group-meeting" }) } as never,
    tasker: tasker as never,
    kick: vi.fn(async () => undefined),
    fetchSlots: async () => ({
      slots: { "2026-10-10": [{ time: "2026-10-10T10:00:00.000Z" }, { time: "2026-10-10T10:30:00.000Z" }] },
    }),
    now: () => NOW,
  });
  return { service, tasker, searchRepo, contactRepo };
};

const window = {
  windowStart: new Date("2026-10-05T00:00:00Z"),
  windowEnd: new Date("2026-10-19T00:00:00Z"),
  timeZone: "UTC",
};

describe("VennSearchService (integration)", () => {
  let userA: number;
  let userB: number;
  let contactIds: number[];

  beforeAll(async () => {
    userA = await createUser("a");
    userB = await createUser("b");
    const contactRepo = new VennContactRepository(prisma);
    const a = await contactRepo.create({
      userId: userA,
      name: "Ana",
      email: `venn-test-${stamp}-ana@example.com`,
      bookingUrl: "https://calendly.com/venn-test/a",
      provider: "CALENDLY",
    });
    const b = await contactRepo.create({
      userId: userA,
      name: "Bob",
      email: `venn-test-${stamp}-bob@example.com`,
      bookingUrl: "https://cal.com/venn-test/b",
      provider: "CALCOM",
    });
    contactIds = [a.id, b.id];
  });

  afterAll(async () => {
    await prisma.vennSearch.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.vennContact.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("startSearch creates one search, N PENDING results and N tasks", async () => {
    const { service, tasker } = makeService();
    const { searchId } = await service.startSearch(userA, { contactIds, ...window });
    const rows = await prisma.vennSearchResult.findMany({
      where: { searchId },
      select: { status: true, contactId: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "PENDING")).toBe(true);
    expect(tasker.create).toHaveBeenCalledTimes(2);
  });

  it("fetching each result flips it DONE and searchStatus returns slots", async () => {
    const { service, searchRepo } = makeService();
    const { searchId } = await service.startSearch(userA, { contactIds, ...window });
    const fetcher = new VennFetchAvailabilityService({
      searchRepo,
      adapterFor: () => ({
        fetchAvailability: async () => ({
          durationMinutes: 30,
          freeIntervals: [{ start: new Date("2026-10-10T10:00:00Z"), end: new Date("2026-10-10T12:00:00Z") }],
        }),
      }),
    });
    const results = await prisma.vennSearchResult.findMany({ where: { searchId }, select: { id: true } });
    expect((await service.searchStatus(userA, { searchId })).status).toBe("PENDING");
    for (const r of results) await fetcher.run(r.id, { isFinalAttempt: true });

    const res = await service.searchStatus(userA, { searchId });
    expect(res.status).toBe("DONE");
    expect(res.defaultDurationMinutes).toBe(30);
    expect(res.slots?.slots["2026-10-10"].map((s) => s.time)).toEqual([
      "2026-10-10T10:00:00.000Z",
      "2026-10-10T10:30:00.000Z",
    ]);
  });

  it("deletes searches older than 24h on the next startSearch", async () => {
    const { service } = makeService();
    const { searchId: oldId } = await service.startSearch(userA, { contactIds, ...window });
    await prisma.vennSearch.update({
      where: { id: oldId },
      data: { createdAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000) },
    });
    await service.startSearch(userA, { contactIds, ...window });
    await expect(service.searchStatus(userA, { searchId: oldId })).rejects.toThrow(/not found/i);
  });

  it("does not let another user read the search", async () => {
    const { service } = makeService();
    const { searchId } = await service.startSearch(userA, { contactIds, ...window });
    await expect(service.searchStatus(userB, { searchId })).rejects.toThrow(/not found/i);
  });
});
