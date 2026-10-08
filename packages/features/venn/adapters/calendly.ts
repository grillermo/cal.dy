import { ErrorWithCode } from "@calcom/lib/errors";
import { z } from "zod";
import { slotsToIntervals } from "../intervals";
import { parseBookingUrl } from "../links/parseBookingUrl";
import { fetchWithRetry } from "./fetchWithRetry";
import type { AvailabilityAdapter } from "./types";

// NOTE: tests use SYNTHETIC fixtures; the real Calendly response shape is unverified until `yarn venn:smoke` is run.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Duration is read from `duration` in the lookup response (assumed shape, see __fixtures__/README.md).
const lookupSchema = z.object({ uuid: z.string(), duration: z.number().int().positive() });

const rangeSchema = z.object({
  days: z.array(
    z.object({
      date: z.string(),
      status: z.string(),
      spots: z.array(z.object({ status: z.string(), start_time: z.string() })).default([]),
    })
  ),
});

type Deps = { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function monthsInWindow(start: Date, end: Date): { rangeStart: string; rangeEnd: string }[] {
  const ranges: { rangeStart: string; rangeEnd: string }[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    const monthStart = cursor;
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const from = start.getTime() > monthStart.getTime() ? start : monthStart;
    const to = end.getTime() < monthEnd.getTime() ? end : monthEnd;
    ranges.push({ rangeStart: isoDate(from), rangeEnd: isoDate(to) });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return ranges;
}

export class CalendlyAdapter implements AvailabilityAdapter {
  private readonly fetchFn: typeof fetch;
  private readonly sleep?: (ms: number) => Promise<void>;

  constructor(deps: Deps = {}) {
    this.fetchFn = deps.fetch ?? fetch;
    this.sleep = deps.sleep;
  }

  async fetchAvailability({ url, start, end }: { url: string; start: Date; end: Date }) {
    const parsed = parseBookingUrl(url, "");
    if (!parsed || parsed.provider !== "CALENDLY") {
      throw ErrorWithCode.Factory.BadRequest(`Not a supported Calendly link: ${url}`);
    }
    const headers = {
      "User-Agent": BROWSER_UA,
      Referer: parsed.normalizedUrl,
      Accept: "application/json",
    };

    const lookupRes = await this.get(
      `https://calendly.com/api/booking/event_types/lookup?event_type_slug=${encodeURIComponent(
        parsed.eventSlug
      )}&profile_slug=${encodeURIComponent(parsed.profile)}`,
      headers
    );
    if (!lookupRes.ok) {
      throw ErrorWithCode.Factory.NotFound(`Calendly event not found for ${url} (HTTP ${lookupRes.status})`);
    }
    const lookup = lookupSchema.safeParse(await lookupRes.json());
    if (!lookup.success) {
      throw ErrorWithCode.Factory.BadRequest(`Unexpected response from Calendly lookup for ${url}`);
    }

    const starts: Date[] = [];
    for (const { rangeStart, rangeEnd } of monthsInWindow(start, end)) {
      const rangeRes = await this.get(
        `https://calendly.com/api/booking/event_types/${lookup.data.uuid}/calendar/range?timezone=UTC&diagnostics=false&range_start=${rangeStart}&range_end=${rangeEnd}`,
        headers
      );
      if (!rangeRes.ok) {
        throw ErrorWithCode.Factory.BadRequest(
          `Calendly availability request failed for ${url} (HTTP ${rangeRes.status})`
        );
      }
      const range = rangeSchema.safeParse(await rangeRes.json());
      if (!range.success) {
        throw ErrorWithCode.Factory.BadRequest(`Unexpected response from Calendly availability for ${url}`);
      }
      for (const day of range.data.days) {
        if (day.status !== "available") continue;
        for (const spot of day.spots) {
          if (spot.status !== "available") continue;
          const at = new Date(spot.start_time);
          if (at.getTime() >= start.getTime() && at.getTime() < end.getTime()) starts.push(at);
        }
      }
    }

    return {
      durationMinutes: lookup.data.duration,
      freeIntervals: slotsToIntervals(starts, lookup.data.duration),
    };
  }

  private get(url: string, headers: Record<string, string>) {
    return fetchWithRetry(this.fetchFn, url, { method: "GET", headers }, { sleep: this.sleep });
  }
}
