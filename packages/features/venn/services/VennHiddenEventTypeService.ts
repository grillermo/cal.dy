import { getBookingFieldsWithSystemFields } from "@calcom/features/bookings/lib/getBookingFields";
import { ALLOWED_DURATIONS, HIDDEN_EVENT_SLUG, HIDDEN_EVENT_TITLE, VENN_TITLE_FIELD } from "../constants";
import type { VennEventTypeRepository } from "../repositories/VennEventTypeRepository";

export interface IVennHiddenEventTypeServiceDeps {
  eventTypeRepo: VennEventTypeRepository;
}

const HIDDEN_EVENT_DEFAULT_LENGTH = 30;

// The per-booking title travels as a hidden booking-field response; getEventName interpolates it into Booking.title.
export const VENN_EVENT_NAME = `{${VENN_TITLE_FIELD}}`;

export function buildVennBookingFields() {
  return getBookingFieldsWithSystemFields({
    bookingFields: [
      {
        name: VENN_TITLE_FIELD,
        type: "text",
        label: "Title",
        hidden: true,
        required: false,
        editable: "user",
        sources: [{ id: "user", type: "user", label: "User" }],
      },
    ],
    disableGuests: false,
    customInputs: [],
    metadata: {},
  });
}

export class VennHiddenEventTypeService {
  constructor(private deps: IVennHiddenEventTypeServiceDeps) {}

  async getOrCreate(userId: number): Promise<{ id: number; slug: string }> {
    const existing = await this.deps.eventTypeRepo.findHiddenByUserId(userId);
    if (existing) return { id: existing.id, slug: HIDDEN_EVENT_SLUG };

    const created = await this.deps.eventTypeRepo.createHidden(userId, {
      title: HIDDEN_EVENT_TITLE,
      slug: HIDDEN_EVENT_SLUG,
      length: HIDDEN_EVENT_DEFAULT_LENGTH,
      eventName: VENN_EVENT_NAME,
      metadata: { multipleDuration: [...ALLOWED_DURATIONS] },
      bookingFields: buildVennBookingFields(),
    });
    return { id: created.id, slug: HIDDEN_EVENT_SLUG };
  }
}
