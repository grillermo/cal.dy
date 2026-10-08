import { ErrorWithCode } from "@calcom/lib/errors";
import { z } from "zod";
import { slotsToIntervals } from "../intervals";
import { parseBookingUrl } from "../links/parseBookingUrl";
import { fetchWithRetry } from "./fetchWithRetry";
import type { AvailabilityAdapter } from "./types";

// NOTE: tests use SYNTHETIC fixtures; the real cal.com response shape is unverified until `yarn venn:smoke` is run.
const slotsSchema = z.object({
  data: z.record(z.array(z.object({ start: z.string() }))),
});
// Duration comes from the event type lookup because /v2/slots only returns slot starts.
const eventTypeSchema = z.object({
  data: z.array(z.object({ lengthInMinutes: z.number().int().positive() })).min(1),
});

type Deps = { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> };

export class CalcomAdapter implements AvailabilityAdapter {
  private readonly fetchFn: typeof fetch;
  private readonly sleep?: (ms: number) => Promise<void>;

  constructor(deps: Deps = {}) {
    this.fetchFn = deps.fetch ?? fetch;
    this.sleep = deps.sleep;
  }

  async fetchAvailability({ url, start, end }: { url: string; start: Date; end: Date }) {
    const parsed = parseBookingUrl(url, "");
    if (!parsed || parsed.provider !== "CALCOM") {
      throw ErrorWithCode.Factory.BadRequest(`Not a supported cal.com link: ${url}`);
    }
    const user = encodeURIComponent(parsed.profile);
    const slug = encodeURIComponent(parsed.eventSlug);

    const slotsRes = await fetchWithRetry(
      this.fetchFn,
      `https://api.cal.com/v2/slots?username=${user}&eventTypeSlug=${slug}&start=${start.toISOString()}&end=${end.toISOString()}&timeZone=UTC`,
      { method: "GET", headers: { "cal-api-version": "2024-09-04" } },
      { sleep: this.sleep }
    );
    if (!slotsRes.ok) {
      throw ErrorWithCode.Factory.NotFound(`cal.com event not found for ${url} (HTTP ${slotsRes.status})`);
    }
    const slotsBody = slotsSchema.safeParse(await slotsRes.json());
    if (!slotsBody.success) {
      throw ErrorWithCode.Factory.BadRequest(`Unexpected response from cal.com slots for ${url}`);
    }

    const typeRes = await fetchWithRetry(
      this.fetchFn,
      `https://api.cal.com/v2/event-types?username=${user}&eventSlug=${slug}`,
      { method: "GET", headers: { "cal-api-version": "2024-06-14" } },
      { sleep: this.sleep }
    );
    const typeBody = eventTypeSchema.safeParse(typeRes.ok ? await typeRes.json() : null);
    if (!typeBody.success) {
      throw ErrorWithCode.Factory.BadRequest(`Unexpected response from cal.com event type for ${url}`);
    }
    const durationMinutes = typeBody.data.data[0].lengthInMinutes;

    const starts = Object.values(slotsBody.data.data)
      .flat()
      .map((s) => new Date(s.start));
    return { durationMinutes, freeIntervals: slotsToIntervals(starts, durationMinutes) };
  }
}
