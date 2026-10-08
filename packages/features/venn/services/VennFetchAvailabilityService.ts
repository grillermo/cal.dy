import type { AvailabilityAdapter } from "../adapters/types";
import { serializeIntervals } from "../intervals";
import type { VennSearchRepository } from "../repositories/VennSearchRepository";
import type { VennProviderKind } from "../types";

export interface IVennFetchAvailabilityServiceDeps {
  searchRepo: VennSearchRepository;
  adapterFor: (provider: VennProviderKind) => AvailabilityAdapter;
}

export class VennFetchAvailabilityService {
  constructor(private deps: IVennFetchAvailabilityServiceDeps) {}

  async run(searchResultId: number, { isFinalAttempt }: { isFinalAttempt: boolean }): Promise<void> {
    const row = await this.deps.searchRepo.findResultForFetch(searchResultId);
    if (!row) return;

    try {
      const { durationMinutes, freeIntervals } = await this.deps
        .adapterFor(row.contact.provider)
        .fetchAvailability({
          url: row.contact.bookingUrl,
          start: row.search.windowStart,
          end: row.search.windowEnd,
        });
      await this.deps.searchRepo.markResultDone(searchResultId, {
        durationMinutes,
        freeIntervals: serializeIntervals(freeIntervals),
      });
    } catch (error) {
      if (isFinalAttempt) {
        const reason = error instanceof Error ? error.message : String(error);
        await this.deps.searchRepo.markResultFailed(searchResultId, `${row.contact.bookingUrl}: ${reason}`);
      }
      throw error;
    }
  }
}
