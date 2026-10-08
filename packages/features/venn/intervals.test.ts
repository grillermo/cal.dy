import { describe, expect, it } from "vitest";
import {
  deserializeIntervals,
  intersectAll,
  intersectIntervals,
  mergeIntervals,
  serializeIntervals,
  slotsToIntervals,
} from "./intervals";

const d = (s: string) => new Date(`${s}Z`);
const iv = (a: string, b: string) => ({ start: d(a), end: d(b) });

describe("slotsToIntervals", () => {
  it("turns slot starts into merged intervals", () => {
    expect(slotsToIntervals([d("2026-10-10T10:30:00"), d("2026-10-10T11:00:00")], 30)).toEqual([
      iv("2026-10-10T10:30:00", "2026-10-10T11:30:00"),
    ]);
  });
  it("returns [] for no slots", () => {
    expect(slotsToIntervals([], 30)).toEqual([]);
  });
});

describe("mergeIntervals", () => {
  it("merges overlapping and touching, keeps gaps, sorts input", () => {
    const out = mergeIntervals([
      iv("2026-10-10T12:00:00", "2026-10-10T13:00:00"),
      iv("2026-10-10T10:00:00", "2026-10-10T11:00:00"),
      iv("2026-10-10T11:00:00", "2026-10-10T11:30:00"),
    ]);
    expect(out).toEqual([
      iv("2026-10-10T10:00:00", "2026-10-10T11:30:00"),
      iv("2026-10-10T12:00:00", "2026-10-10T13:00:00"),
    ]);
  });
});

describe("intersectIntervals", () => {
  it("returns the overlap (worked example from the spec)", () => {
    const ana = [iv("2026-10-10T10:00:00", "2026-10-10T11:00:00")];
    const bob = [iv("2026-10-10T10:30:00", "2026-10-10T11:30:00")];
    expect(intersectIntervals(ana, bob)).toEqual([iv("2026-10-10T10:30:00", "2026-10-10T11:00:00")]);
  });
  it("returns [] when intervals only touch", () => {
    expect(
      intersectIntervals(
        [iv("2026-10-10T10:00:00", "2026-10-10T11:00:00")],
        [iv("2026-10-10T11:00:00", "2026-10-10T12:00:00")]
      )
    ).toEqual([]);
  });
  it("handles a window crossing a month and year boundary", () => {
    const a = [iv("2026-12-31T23:00:00", "2027-01-01T01:00:00")];
    const b = [iv("2026-12-31T23:30:00", "2027-01-01T00:30:00")];
    expect(intersectIntervals(a, b)).toEqual([iv("2026-12-31T23:30:00", "2027-01-01T00:30:00")]);
  });
});

describe("intersectAll", () => {
  it("returns [] for no participants", () => {
    expect(intersectAll([])).toEqual([]);
  });
  it("returns [] when any participant has no availability", () => {
    expect(intersectAll([[iv("2026-10-10T10:00:00", "2026-10-10T11:00:00")], []])).toEqual([]);
  });
});

describe("serialization", () => {
  it("round-trips through JSON", () => {
    const original = [iv("2026-10-10T10:00:00", "2026-10-10T11:00:00")];
    expect(deserializeIntervals(JSON.parse(JSON.stringify(serializeIntervals(original))))).toEqual(original);
  });
  it("throws on malformed stored data", () => {
    expect(() => deserializeIntervals([{ start: "nope", end: 1 }])).toThrow();
  });
});
