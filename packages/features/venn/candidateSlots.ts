import { ALLOWED_DURATIONS, MIN_NOTICE_MINUTES, SLOT_STEP_MINUTES } from "./constants";
import type { Interval, VennSlots } from "./types";

const MS_PER_MINUTE = 60_000;

function dateKeyInZone(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is the key shape slots.getSchedule uses.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function defaultDurationMinutes(contactDurations: number[]): number {
  if (contactDurations.length === 0) return 30;
  const min = Math.min(...contactDurations);
  const allowed = ALLOWED_DURATIONS.filter((d) => d <= min);
  return allowed.length ? allowed[allowed.length - 1] : ALLOWED_DURATIONS[0];
}

export function buildCandidateSlots(args: {
  intervals: Interval[];
  durationMinutes: number;
  now: Date;
  timeZone: string;
}): VennSlots {
  const { intervals, durationMinutes, now, timeZone } = args;
  const stepMs = SLOT_STEP_MINUTES * MS_PER_MINUTE;
  const durationMs = durationMinutes * MS_PER_MINUTE;
  const earliest = now.getTime() + MIN_NOTICE_MINUTES * MS_PER_MINUTE;
  const slots: VennSlots["slots"] = {};

  for (const interval of intervals) {
    const firstStart = Math.ceil(interval.start.getTime() / stepMs) * stepMs;
    for (let t = firstStart; t + durationMs <= interval.end.getTime(); t += durationMs) {
      if (t < earliest) continue;
      const time = new Date(t);
      const key = dateKeyInZone(time, timeZone);
      if (!slots[key]) slots[key] = [];
      slots[key].push({ time: time.toISOString() });
    }
  }
  return { slots };
}
