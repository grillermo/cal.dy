import { z } from "zod";
import type { Interval } from "./types";

const MS_PER_MINUTE = 60_000;
const storedIntervalsSchema = z.array(z.object({ start: z.string().datetime(), end: z.string().datetime() }));

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) last.end = current.end;
      continue;
    }
    merged.push({ start: current.start, end: current.end });
  }
  return merged;
}

export function slotsToIntervals(starts: Date[], durationMinutes: number): Interval[] {
  return mergeIntervals(
    starts.map((start) => ({ start, end: new Date(start.getTime() + durationMinutes * MS_PER_MINUTE) }))
  );
}

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start.getTime(), b[j].start.getTime());
    const end = Math.min(a[i].end.getTime(), b[j].end.getTime());
    if (start < end) out.push({ start: new Date(start), end: new Date(end) });
    if (a[i].end.getTime() < b[j].end.getTime()) i++;
    else j++;
  }
  return out;
}

export function intersectAll(lists: Interval[][]): Interval[] {
  if (lists.length === 0) return [];
  return lists.map(mergeIntervals).reduce((acc, next) => intersectIntervals(acc, next));
}

export function serializeIntervals(intervals: Interval[]): { start: string; end: string }[] {
  return intervals.map((i) => ({ start: i.start.toISOString(), end: i.end.toISOString() }));
}

export function deserializeIntervals(json: unknown): Interval[] {
  return storedIntervalsSchema.parse(json).map((i) => ({ start: new Date(i.start), end: new Date(i.end) }));
}
