import type { CreateBookingMeta, CreateRegularBookingData } from "@calcom/features/bookings/lib/dto/types";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { DEFAULT_TITLE, STALE_AFTER_MS, VENN_TITLE_FIELD } from "../constants";
import type { VennContactRepository } from "../repositories/VennContactRepository";
import type { VennSearchRepository } from "../repositories/VennSearchRepository";
import type { VennHiddenEventTypeService } from "./VennHiddenEventTypeService";
import type { VennSearchService } from "./VennSearchService";

// The first selected contact becomes the primary attendee, so keep the order the user picked.
function orderBy<T extends { id: number }>(rows: T[], ids: number[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  return ordered;
}

function dedupeAttendees(contacts: { name: string; email: string }[], organizerEmail: string) {
  const seen = new Set([organizerEmail.toLowerCase()]);
  const out: { name: string; email: string }[] = [];
  for (const contact of contacts) {
    const email = contact.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ name: contact.name, email });
  }
  return out;
}

export type VennBookingData = CreateRegularBookingData & { responses: Record<string, unknown> };

export type VennCreateBooking = (input: {
  bookingData: VennBookingData;
  bookingMeta: CreateBookingMeta;
}) => Promise<{ uid: string }>;

export interface IVennBookingServiceDeps {
  searchRepo: Pick<VennSearchRepository, "findByIdAndUserId">;
  contactRepo: Pick<VennContactRepository, "findManyByIdsAndUserId">;
  hiddenEventTypeService: Pick<VennHiddenEventTypeService, "getOrCreate">;
  searchService: Pick<VennSearchService, "computeCandidateSlots">;
  createBooking: VennCreateBooking;
  hostname: string;
  now: () => Date;
}

export type VennBookInput = {
  searchId: string;
  start: string;
  durationMinutes: number;
  title: string;
  timeZone: string;
  language: string;
  organizer: { name: string; email: string };
};

export class VennBookingService {
  constructor(private deps: IVennBookingServiceDeps) {}

  async book(userId: number, input: VennBookInput): Promise<{ uid: string }> {
    const search = await this.deps.searchRepo.findByIdAndUserId(input.searchId, userId);
    if (!search) throw ErrorWithCode.Factory.NotFound("Search not found");
    if (search.results.some((r) => r.status !== "DONE")) {
      throw ErrorWithCode.Factory.BadRequest("Search is not done yet");
    }

    const oldestFetch = Math.min(...search.results.map((r) => r.fetchedAt?.getTime() ?? 0));
    if (this.deps.now().getTime() - oldestFetch > STALE_AFTER_MS) {
      throw new ErrorWithCode(ErrorCode.VennSearchStale, "The availability data is out of date");
    }

    const startMs = new Date(input.start).getTime();
    const candidates = await this.deps.searchService.computeCandidateSlots(
      userId,
      search,
      input.durationMinutes
    );
    const stillOpen = Object.values(candidates.slots).some((day) =>
      day.some((slot) => new Date(slot.time).getTime() === startMs)
    );
    if (!stillOpen) throw new ErrorWithCode(ErrorCode.VennSlotTaken, "That time is no longer available");

    const contacts = await this.deps.contactRepo.findManyByIdsAndUserId(search.contactIds, userId);
    if (contacts.length !== search.contactIds.length) {
      throw ErrorWithCode.Factory.BadRequest(
        "A contact in this search was removed. Find times again before booking."
      );
    }
    const attendees = dedupeAttendees(orderBy(contacts, search.contactIds), input.organizer.email);
    const [primary, ...guests] = attendees;
    if (!primary) throw ErrorWithCode.Factory.BadRequest("No attendees left after removing the organizer");

    const hidden = await this.deps.hiddenEventTypeService.getOrCreate(userId);
    const end = new Date(startMs + input.durationMinutes * 60_000).toISOString();
    // An empty venn_title makes getEventName produce an empty booking title, so never send a blank one.
    const title = input.title.trim() || DEFAULT_TITLE;

    return this.deps.createBooking({
      bookingData: {
        eventTypeId: hidden.id,
        eventTypeSlug: hidden.slug,
        start: input.start,
        end,
        timeZone: input.timeZone,
        language: input.language,
        metadata: {},
        responses: {
          name: primary.name,
          email: primary.email,
          guests: guests.map((g) => g.email),
          [VENN_TITLE_FIELD]: title,
        },
      },
      // Availability was already checked against the organizer's slots when recomputing candidates.
      bookingMeta: {
        userId,
        hostname: this.deps.hostname,
        skipAvailabilityCheck: true,
        skipEventLimitsCheck: false,
      },
    });
  }
}
