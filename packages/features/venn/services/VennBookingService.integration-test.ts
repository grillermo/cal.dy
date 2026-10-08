import process from "node:process";
import { ErrorCode } from "@calcom/lib/errorCodes";
import prisma from "@calcom/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HIDDEN_EVENT_SLUG } from "../constants";
import { getVennBookingService } from "../di/VennBookingService.container";
import { VennContactRepository } from "../repositories/VennContactRepository";

const DAY_MS = 24 * 60 * 60 * 1000;
const stamp = Date.now();
const userIds: number[] = [];

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const slotStart = new Date(today.getTime() + DAY_MS + 10 * 60 * 60 * 1000);
const freeInterval = {
  start: new Date(slotStart.getTime() - 60 * 60 * 1000).toISOString(),
  end: new Date(slotStart.getTime() + 2 * 60 * 60 * 1000).toISOString(),
};

const createOrganizer = async (suffix: string) => {
  const user = await prisma.user.create({
    data: {
      email: `venn-test-${stamp}-${suffix}@example.com`,
      username: `venn-test-${stamp}-${suffix}`,
      name: "Venn Organizer",
      timeZone: "UTC",
      schedules: {
        create: {
          name: "Working hours",
          timeZone: "UTC",
          availability: {
            create: [
              {
                days: [0, 1, 2, 3, 4, 5, 6],
                startTime: new Date("1970-01-01T09:00:00Z"),
                endTime: new Date("1970-01-01T17:00:00Z"),
              },
            ],
          },
        },
      },
    },
    select: { id: true, email: true, schedules: { select: { id: true } } },
  });
  await prisma.user.update({ where: { id: user.id }, data: { defaultScheduleId: user.schedules[0].id } });
  userIds.push(user.id);
  return user;
};

const createSearch = async (userId: number, contactIds: number[], fetchedAt: Date) => {
  const search = await prisma.vennSearch.create({
    data: {
      userId,
      contactIds,
      windowStart: today,
      windowEnd: new Date(today.getTime() + 3 * DAY_MS),
      timeZone: "UTC",
      results: {
        create: contactIds.map((contactId) => ({
          contactId,
          status: "DONE" as const,
          durationMinutes: 30,
          freeIntervals: [freeInterval],
          fetchedAt,
        })),
      },
    },
    select: { id: true },
  });
  return search.id;
};

describe("VennBookingService (integration)", () => {
  let organizer: { id: number; email: string };
  let contactIds: number[];
  let anaEmail: string;
  let bobEmail: string;

  beforeAll(async () => {
    // Guard against ever creating real bookings outside the throwaway DB or sending real emails.
    const dbName = new URL(process.env.DATABASE_URL ?? "postgresql://x/none").pathname;
    if (dbName !== "/venn_test") throw new Error(`Refusing to run against ${dbName}`);
    if (process.env.INTEGRATION_TEST_MODE !== "true") throw new Error("INTEGRATION_TEST_MODE must be true");

    organizer = await createOrganizer("org");
    anaEmail = `venn-test-${stamp}-ana@example.com`;
    bobEmail = `venn-test-${stamp}-bob@example.com`;
    const contactRepo = new VennContactRepository(prisma);
    const ana = await contactRepo.create({
      userId: organizer.id,
      name: "Ana",
      email: anaEmail,
      bookingUrl: "https://calendly.com/venn-test/a",
      provider: "CALENDLY",
    });
    const bob = await contactRepo.create({
      userId: organizer.id,
      name: "Bob",
      email: bobEmail,
      bookingUrl: "https://cal.com/venn-test/b",
      provider: "CALCOM",
    });
    contactIds = [ana.id, bob.id];
  });

  afterAll(async () => {
    const bookings = await prisma.booking.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const bookingIds = bookings.map((b) => b.id);
    await prisma.attendee.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.vennSearch.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.vennContact.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.eventType.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.availability.deleteMany({ where: { Schedule: { userId: { in: userIds } } } });
    await prisma.schedule.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  const bookInput = (searchId: string) => ({
    searchId,
    start: slotStart.toISOString(),
    durationMinutes: 30,
    title: "Venn sync",
    timeZone: "UTC",
    language: "en",
    organizer: { name: "Venn Organizer", email: organizer.email },
  });

  it("creates a booking on the hidden event type with the contacts as attendees", async () => {
    const searchId = await createSearch(organizer.id, contactIds, new Date());
    const { uid } = await getVennBookingService().book(organizer.id, bookInput(searchId));

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { uid },
      select: {
        title: true,
        startTime: true,
        endTime: true,
        userId: true,
        eventType: { select: { slug: true, hidden: true, locations: true } },
        attendees: { select: { email: true } },
      },
    });
    expect(booking.userId).toBe(organizer.id);
    expect(booking.eventType).toMatchObject({ slug: HIDDEN_EVENT_SLUG, hidden: true });
    expect(booking.title).toBe("Venn sync");
    expect(booking.endTime.getTime() - booking.startTime.getTime()).toBe(30 * 60 * 1000);
    expect(booking.startTime.toISOString()).toBe(slotStart.toISOString());
    expect(booking.attendees.map((a) => a.email).sort()).toEqual([anaEmail, bobEmail].sort());
  }, 60_000);

  it("rejects a stale search without creating a booking", async () => {
    const before = await prisma.booking.count({ where: { userId: organizer.id } });
    const searchId = await createSearch(organizer.id, contactIds, new Date(Date.now() - 10 * 60 * 1000));
    await expect(getVennBookingService().book(organizer.id, bookInput(searchId))).rejects.toMatchObject({
      code: ErrorCode.VennSearchStale,
    });
    expect(await prisma.booking.count({ where: { userId: organizer.id } })).toBe(before);
  }, 60_000);
});
