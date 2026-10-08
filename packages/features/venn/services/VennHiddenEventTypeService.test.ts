import getBookingResponsesSchema from "@calcom/features/bookings/lib/getBookingResponsesSchema";
import { getEventName } from "@calcom/features/eventtypes/lib/eventNaming";
import { describe, expect, it, vi } from "vitest";
import { ALLOWED_DURATIONS, HIDDEN_EVENT_SLUG, HIDDEN_EVENT_TITLE, VENN_TITLE_FIELD } from "../constants";
import {
  buildVennBookingFields,
  VENN_EVENT_NAME,
  VennHiddenEventTypeService,
} from "./VennHiddenEventTypeService";

describe("VennHiddenEventTypeService.getOrCreate", () => {
  it("returns the existing hidden event type without creating another", async () => {
    const repo = { findHiddenByUserId: vi.fn(async () => ({ id: 9 })), createHidden: vi.fn() };
    const res = await new VennHiddenEventTypeService({ eventTypeRepo: repo as never }).getOrCreate(1);
    expect(res).toEqual({ id: 9, slug: HIDDEN_EVENT_SLUG });
    expect(repo.createHidden).not.toHaveBeenCalled();
  });

  it("creates it once with multi-duration metadata", async () => {
    const repo = {
      findHiddenByUserId: vi.fn(async () => null),
      createHidden: vi.fn(async () => ({ id: 10 })),
    };
    const res = await new VennHiddenEventTypeService({ eventTypeRepo: repo as never }).getOrCreate(1);
    expect(res.id).toBe(10);
    expect(repo.createHidden).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: HIDDEN_EVENT_TITLE,
        slug: HIDDEN_EVENT_SLUG,
        length: 30,
        eventName: VENN_EVENT_NAME,
        metadata: { multipleDuration: [...ALLOWED_DURATIONS] },
      })
    );
  });
});

describe("venn_title booking field (spike proof with real cal.diy code)", () => {
  const bookingFields = buildVennBookingFields();

  it("keeps the hidden venn_title field next to the system fields", () => {
    const names = bookingFields.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["name", "email", VENN_TITLE_FIELD]));
    const field = bookingFields.find((f) => f.name === VENN_TITLE_FIELD);
    expect(field).toMatchObject({ type: "text", hidden: true, required: false });
  });

  it("(a) accepts a venn_title response in the booking responses schema", async () => {
    const schema = getBookingResponsesSchema({ bookingFields, view: "ALL_VIEWS" });
    const parsed = await schema.safeParseAsync({
      name: "Host",
      email: "venn-test-a@example.com",
      [VENN_TITLE_FIELD]: "Sprint Planning",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data[VENN_TITLE_FIELD]).toBe("Sprint Planning");
  });

  it("(b) getEventName turns {venn_title} into the booking title", () => {
    const title = getEventName({
      attendeeName: "Host",
      eventType: HIDDEN_EVENT_TITLE,
      eventName: VENN_EVENT_NAME,
      host: "Organizer",
      eventDuration: 30,
      bookingFields: { [VENN_TITLE_FIELD]: "Sprint Planning" },
      t: ((k: string) => k) as never,
    });
    expect(title).toBe("Sprint Planning");
  });
});
