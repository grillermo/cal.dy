import { describe, expect, it } from "vitest";
import { buildCandidateSlots, defaultDurationMinutes } from "./candidateSlots";

const d = (s: string) => new Date(`${s}Z`);
const iv = (a: string, b: string) => ({ start: d(a), end: d(b) });
const NOW = d("2026-10-01T00:00:00");

describe("defaultDurationMinutes", () => {
  it("uses the minimum across contacts", () => expect(defaultDurationMinutes([60, 30])).toBe(30));
  it("snaps down to an allowed duration", () => expect(defaultDurationMinutes([35, 90])).toBe(30));
  it("defaults to 30 with no contacts", () => expect(defaultDurationMinutes([])).toBe(30));
  it("never goes below 15", () => expect(defaultDurationMinutes([10])).toBe(15));
});

describe("buildCandidateSlots", () => {
  it("produces the spec's worked example: one 30m slot at 10:30", () => {
    const out = buildCandidateSlots({
      intervals: [iv("2026-10-10T10:30:00", "2026-10-10T11:00:00")],
      durationMinutes: 30,
      now: NOW,
      timeZone: "UTC",
    });
    expect(out.slots).toEqual({ "2026-10-10": [{ time: "2026-10-10T10:30:00.000Z" }] });
  });

  it("rounds interval start up to the next 15 minutes and steps by duration", () => {
    const out = buildCandidateSlots({
      intervals: [iv("2026-10-10T10:07:00", "2026-10-10T12:00:00")],
      durationMinutes: 30,
      now: NOW,
      timeZone: "UTC",
    });
    expect(out.slots["2026-10-10"].map((s) => s.time)).toEqual([
      "2026-10-10T10:15:00.000Z",
      "2026-10-10T10:45:00.000Z",
      "2026-10-10T11:15:00.000Z",
    ]);
  });

  it("drops an interval whose leftover is shorter than the duration", () => {
    const out = buildCandidateSlots({
      intervals: [iv("2026-10-10T10:00:00", "2026-10-10T10:20:00")],
      durationMinutes: 30,
      now: NOW,
      timeZone: "UTC",
    });
    expect(out.slots).toEqual({});
  });

  it("drops starts earlier than now + 2h", () => {
    const now = d("2026-10-10T09:00:00");
    const out = buildCandidateSlots({
      intervals: [iv("2026-10-10T09:00:00", "2026-10-10T12:00:00")],
      durationMinutes: 30,
      now,
      timeZone: "UTC",
    });
    expect(out.slots["2026-10-10"][0].time).toBe("2026-10-10T11:00:00.000Z");
  });

  it("groups by date in the organizer's timezone", () => {
    const out = buildCandidateSlots({
      intervals: [iv("2026-10-11T02:00:00", "2026-10-11T03:00:00")], // 21:00 on the 10th in Mexico City (UTC-6)
      durationMinutes: 30,
      now: NOW,
      timeZone: "America/Mexico_City",
    });
    expect(Object.keys(out.slots)).toEqual(["2026-10-10"]);
  });

  it("groups correctly across a DST change (US, 2026-11-01)", () => {
    const out = buildCandidateSlots({
      intervals: [iv("2026-11-01T05:30:00", "2026-11-01T06:30:00")],
      durationMinutes: 30,
      now: NOW,
      timeZone: "America/New_York",
    });
    expect(Object.keys(out.slots)).toEqual(["2026-11-01"]);
  });
});
