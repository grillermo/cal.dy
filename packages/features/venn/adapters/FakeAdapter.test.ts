import { describe, expect, it } from "vitest";
import { FakeAdapter } from "./FakeAdapter";

const start = new Date("2030-01-07T00:00:00Z"); // Monday
const end = new Date("2030-01-21T00:00:00Z");

describe("FakeAdapter", () => {
  const adapter = new FakeAdapter();

  it("returns the configured duration per link", async () => {
    expect(
      (await adapter.fetchAvailability({ url: "https://calendly.com/ana/60min", start, end })).durationMinutes
    ).toBe(60);
    expect(
      (await adapter.fetchAvailability({ url: "https://cal.com/bob/30min", start, end })).durationMinutes
    ).toBe(30);
  });

  it("returns 14:00-20:00 UTC windows on weekdays only", async () => {
    const { freeIntervals } = await adapter.fetchAvailability({
      url: "https://cal.com/bob/30min",
      start,
      end,
    });
    expect(freeIntervals).toHaveLength(10);
    for (const i of freeIntervals) {
      expect([0, 6]).not.toContain(i.start.getUTCDay());
      expect(i.start.getUTCHours()).toBe(14);
      expect(i.end.getUTCHours()).toBe(20);
    }
  });

  it("clips windows to the requested range", async () => {
    const { freeIntervals } = await adapter.fetchAvailability({
      url: "https://cal.com/bob/30min",
      start: new Date("2030-01-07T16:00:00Z"),
      end: new Date("2030-01-07T18:00:00Z"),
    });
    expect(freeIntervals).toEqual([
      { start: new Date("2030-01-07T16:00:00Z"), end: new Date("2030-01-07T18:00:00Z") },
    ]);
  });

  it("throws a not-found error naming the missing link", async () => {
    await expect(
      adapter.fetchAvailability({ url: "https://calendly.com/missing/event", start, end })
    ).rejects.toThrow("https://calendly.com/missing/event");
  });
});
