import type { Interval } from "../types";

export interface AvailabilityAdapter {
  fetchAvailability(args: { url: string; start: Date; end: Date }): Promise<{
    durationMinutes: number;
    freeIntervals: Interval[];
  }>;
}
