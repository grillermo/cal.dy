import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/features/di/containers/AvailableSlots", () => ({ getAvailableSlotsService: vi.fn() }));

import { LocalAdapter } from "./local";

const base = {
  url: "https://cal.example.com/me/intro",
  start: new Date("2026-10-12T00:00:00Z"),
  end: new Date("2026-10-19T00:00:00Z"),
};

describe("LocalAdapter", () => {
  it("reads event length and converts getSchedule slots to merged intervals", async () => {
    const fetchSlots = vi.fn(async () => ({
      slots: { "2026-10-12": [{ time: "2026-10-12T10:00:00.000Z" }, { time: "2026-10-12T10:30:00.000Z" }] },
    }));
    const lookup = { findLengthByUsernameAndSlug: vi.fn(async () => 30) };
    const res = await new LocalAdapter({
      lookup,
      fetchSlots,
      localHost: "cal.example.com",
    }).fetchAvailability(base);
    expect(res.durationMinutes).toBe(30);
    expect(res.freeIntervals).toEqual([
      { start: new Date("2026-10-12T10:00:00Z"), end: new Date("2026-10-12T11:00:00Z") },
    ]);
    expect(fetchSlots).toHaveBeenCalledWith(
      expect.objectContaining({ usernameList: ["me"], eventTypeSlug: "intro" })
    );
  });

  it("fails naming the link when the event type does not exist", async () => {
    const lookup = { findLengthByUsernameAndSlug: vi.fn(async () => null) };
    await expect(
      new LocalAdapter({ lookup, fetchSlots: vi.fn(), localHost: "cal.example.com" }).fetchAvailability(base)
    ).rejects.toThrow(base.url);
  });

  it("returns no intervals when the user has no slots", async () => {
    const lookup = { findLengthByUsernameAndSlug: vi.fn(async () => 30) };
    const res = await new LocalAdapter({
      lookup,
      fetchSlots: vi.fn(async () => ({ slots: {} })),
      localHost: "cal.example.com",
    }).fetchAvailability(base);
    expect(res.freeIntervals).toEqual([]);
  });
});
