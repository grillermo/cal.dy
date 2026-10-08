import { ErrorWithCode } from "@calcom/lib/errors";
import type { Interval } from "../types";
import type { AvailabilityAdapter } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const FREE_FROM_UTC_HOUR = 14;
const FREE_TO_UTC_HOUR = 20;

const DURATION_BY_LINK: Record<string, number> = {
  "https://calendly.com/ana/60min": 60,
  "https://cal.com/bob/30min": 30,
};
const MISSING_LINKS = new Set(["https://calendly.com/missing/event"]);

const normalize = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();

// Weekday windows at a fixed UTC time of day so they overlap a default organizer schedule in any timezone near UTC-5..UTC+0.
function weekdayWindows(start: Date, end: Date): Interval[] {
  const intervals: Interval[] = [];
  const firstDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  for (let day = firstDay; day <= end.getTime(); day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const from = Math.max(day + FREE_FROM_UTC_HOUR * 60 * 60 * 1000, start.getTime());
    const to = Math.min(day + FREE_TO_UTC_HOUR * 60 * 60 * 1000, end.getTime());
    if (from < to) intervals.push({ start: new Date(from), end: new Date(to) });
  }
  return intervals;
}

export class FakeAdapter implements AvailabilityAdapter {
  async fetchAvailability({ url, start, end }: { url: string; start: Date; end: Date }) {
    const key = normalize(url);
    if (MISSING_LINKS.has(key)) {
      throw ErrorWithCode.Factory.NotFound(`Booking link not found: ${url}`);
    }
    return { durationMinutes: DURATION_BY_LINK[key] ?? 30, freeIntervals: weekdayWindows(start, end) };
  }
}
