import { getAvailableSlotsService } from "@calcom/features/di/containers/AvailableSlots";
import { ErrorWithCode } from "@calcom/lib/errors";
import { slotsToIntervals } from "../intervals";
import { parseBookingUrl } from "../links/parseBookingUrl";
import type { AvailabilityAdapter } from "./types";

type Deps = { lookup: LocalEventTypeLookup; fetchSlots: FetchLocalSlots; localHost: string };

export interface LocalEventTypeLookup {
  findLengthByUsernameAndSlug(username: string, slug: string): Promise<number | null>;
}

export type FetchLocalSlots = (input: {
  usernameList?: string[];
  eventTypeSlug?: string;
  eventTypeId?: number;
  startTime: string;
  endTime: string;
  duration?: number;
}) => Promise<{ slots: Record<string, { time: string }[]> }>;

// The service takes the already-parsed tRPC input, where duration is a number (the router's schema coerces the string).
export const fetchLocalSlotsFromService: FetchLocalSlots = async (input) => {
  const result = await getAvailableSlotsService().getAvailableSlots({
    ctx: {},
    input: {
      ...input,
      timeZone: "UTC",
      isTeamEvent: false,
      orgSlug: null,
    } as Parameters<ReturnType<typeof getAvailableSlotsService>["getAvailableSlots"]>[0]["input"],
  });
  return { slots: result.slots };
};

export function localSlotsToStarts(slots: Record<string, { time: string }[]>): Date[] {
  return Object.values(slots)
    .flat()
    .map((s) => new Date(s.time));
}

export class LocalAdapter implements AvailabilityAdapter {
  constructor(private deps: Deps) {}

  async fetchAvailability({ url, start, end }: { url: string; start: Date; end: Date }) {
    const parsed = parseBookingUrl(url, this.deps.localHost);
    if (!parsed || parsed.provider !== "LOCAL") {
      throw ErrorWithCode.Factory.BadRequest(`Not a link on this instance: ${url}`);
    }
    const durationMinutes = await this.deps.lookup.findLengthByUsernameAndSlug(
      parsed.profile,
      parsed.eventSlug
    );
    if (durationMinutes === null) {
      throw ErrorWithCode.Factory.NotFound(`Event not found on this instance for ${url}`);
    }
    const { slots } = await this.deps.fetchSlots({
      usernameList: [parsed.profile],
      eventTypeSlug: parsed.eventSlug,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    return { durationMinutes, freeIntervals: slotsToIntervals(localSlotsToStarts(slots), durationMinutes) };
  }
}
