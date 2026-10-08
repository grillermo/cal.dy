import { describe, expect, it, vi } from "vitest";
import lookup from "./__fixtures__/calendly-lookup.json";
import oct from "./__fixtures__/calendly-range-2026-10.json";
import nov from "./__fixtures__/calendly-range-2026-11.json";
import { CalendlyAdapter, monthsInWindow } from "./calendly";

const LINK = "https://calendly.com/ana/60min";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const sleep = async () => {};

describe("monthsInWindow", () => {
  it("returns one range per calendar month touched", () => {
    expect(monthsInWindow(new Date("2026-10-20T00:00:00Z"), new Date("2026-11-05T00:00:00Z"))).toEqual([
      { rangeStart: "2026-10-20", rangeEnd: "2026-10-31" },
      { rangeStart: "2026-11-01", rangeEnd: "2026-11-05" },
    ]);
  });
  it("crosses a year boundary", () => {
    expect(monthsInWindow(new Date("2026-12-28T00:00:00Z"), new Date("2027-01-03T00:00:00Z"))).toHaveLength(
      2
    );
  });
});

describe("CalendlyAdapter", () => {
  it("looks up the event, fetches each month, and only keeps available spots", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/lookup")) return json(lookup);
      if (url.includes("range_start=2026-10")) return json(oct);
      if (url.includes("range_start=2026-11")) return json(nov);
      return json({}, 404);
    });
    const adapter = new CalendlyAdapter({ fetch: fetchMock as unknown as typeof fetch, sleep });
    const res = await adapter.fetchAvailability({
      url: LINK,
      start: new Date("2026-10-20T00:00:00Z"),
      end: new Date("2026-11-05T00:00:00Z"),
    });
    expect(res.durationMinutes).toBe(60);
    // Oct 21 14:00 and 15:00 merge; unavailable spot/day entries are dropped.
    expect(res.freeIntervals).toEqual([
      { start: new Date("2026-10-21T14:00:00Z"), end: new Date("2026-10-21T16:00:00Z") },
      { start: new Date("2026-10-22T09:00:00Z"), end: new Date("2026-10-22T10:00:00Z") },
      { start: new Date("2026-11-02T10:00:00Z"), end: new Date("2026-11-02T11:00:00Z") },
    ]);
    const rangeCall = fetchMock.mock.calls.find(([u]) => u.includes("/calendar/range"));
    expect(rangeCall?.[1]).toMatchObject({ headers: expect.objectContaining({ Referer: LINK }) });
  });

  it("returns an empty interval list (not an error) when nothing is available", async () => {
    const empty = { days: [] };
    const fetchMock = vi.fn(async (url: string) => (url.includes("/lookup") ? json(lookup) : json(empty)));
    const adapter = new CalendlyAdapter({ fetch: fetchMock as unknown as typeof fetch, sleep });
    const res = await adapter.fetchAvailability({
      url: LINK,
      start: new Date("2026-10-20T00:00:00Z"),
      end: new Date("2026-10-27T00:00:00Z"),
    });
    expect(res.freeIntervals).toEqual([]);
  });

  it("fails with the link in the message when the event is not found", async () => {
    const fetchMock = vi.fn(async () => json({ message: "not found" }, 404));
    const adapter = new CalendlyAdapter({ fetch: fetchMock as unknown as typeof fetch, sleep });
    await expect(
      adapter.fetchAvailability({
        url: "https://calendly.com/x/y",
        start: new Date("2026-10-20T00:00:00Z"),
        end: new Date("2026-10-27T00:00:00Z"),
      })
    ).rejects.toThrow("https://calendly.com/x/y");
  });

  it("fails clearly on a malformed range body", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/lookup") ? json(lookup) : json({ nope: 1 })
    );
    const adapter = new CalendlyAdapter({ fetch: fetchMock as unknown as typeof fetch, sleep });
    await expect(
      adapter.fetchAvailability({
        url: LINK,
        start: new Date("2026-10-20T00:00:00Z"),
        end: new Date("2026-10-27T00:00:00Z"),
      })
    ).rejects.toThrow(/unexpected response/i);
  });
});
