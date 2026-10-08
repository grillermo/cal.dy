import { describe, expect, it, vi } from "vitest";
import eventType from "./__fixtures__/calcom-event-type.json";
import slots from "./__fixtures__/calcom-slots.json";
import { CalcomAdapter } from "./calcom";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sleep = async () => {};
const args = {
  url: "https://cal.com/bob/30min",
  start: new Date("2026-10-12T00:00:00Z"),
  end: new Date("2026-10-19T00:00:00Z"),
};

describe("CalcomAdapter", () => {
  it("sends the api version header, no auth, and builds merged intervals", async () => {
    const f = vi.fn(async (url: string) => (url.includes("/slots") ? json(slots) : json(eventType)));
    const res = await new CalcomAdapter({ fetch: f as unknown as typeof fetch, sleep }).fetchAvailability(
      args
    );
    expect(res.durationMinutes).toBe(30);
    expect(res.freeIntervals).toEqual([
      { start: new Date("2026-10-13T09:00:00Z"), end: new Date("2026-10-13T10:00:00Z") },
      { start: new Date("2026-10-14T15:00:00Z"), end: new Date("2026-10-14T15:30:00Z") },
    ]);
    const slotsCall = f.mock.calls.find(([u]) => u.includes("/v2/slots"));
    expect(slotsCall?.[1]).toMatchObject({
      headers: expect.objectContaining({ "cal-api-version": "2024-09-04" }),
    });
    expect(JSON.stringify(slotsCall?.[1])).not.toMatch(/authorization/i);
  });

  it("treats an empty slots object as DONE with no intervals", async () => {
    const f = vi.fn(async (url: string) =>
      url.includes("/slots") ? json({ status: "success", data: {} }) : json(eventType)
    );
    const res = await new CalcomAdapter({ fetch: f as unknown as typeof fetch, sleep }).fetchAvailability(
      args
    );
    expect(res.freeIntervals).toEqual([]);
  });

  it("fails naming the link on 404 Event Type not found", async () => {
    const f = vi.fn(async () => json({ status: "error", error: { message: "Event Type not found" } }, 404));
    await expect(
      new CalcomAdapter({ fetch: f as unknown as typeof fetch, sleep }).fetchAvailability(args)
    ).rejects.toThrow(args.url);
  });

  it("fails clearly on a malformed body", async () => {
    const f = vi.fn(async () => json({ unexpected: true }));
    await expect(
      new CalcomAdapter({ fetch: f as unknown as typeof fetch, sleep }).fetchAvailability(args)
    ).rejects.toThrow(/unexpected response/i);
  });

  it("names the link when the upstream keeps returning 503", async () => {
    const f = vi.fn(async () => json({}, 503));
    await expect(
      new CalcomAdapter({ fetch: f as unknown as typeof fetch, sleep }).fetchAvailability(args)
    ).rejects.toThrow(args.url);
  });

  it("names the link on a network failure", async () => {
    const f = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    await expect(
      new CalcomAdapter({ fetch: f as unknown as typeof fetch, sleep }).fetchAvailability(args)
    ).rejects.toThrow(new RegExp(`${escapeRegExp(args.url)}.*ECONNRESET`));
  });
});
