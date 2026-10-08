import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import type { AvailabilityAdapter } from "../adapters/types";
import { serializeIntervals } from "../intervals";
import type { VennSearchRepository } from "../repositories/VennSearchRepository";
import type { VennProviderKind } from "../types";

// Adapters signal a dead link or an unparseable response with these codes; retrying cannot fix either, so the
// participant fails at once instead of after the remaining Tasker attempts (which need the cron to run).
const PERMANENT_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([ErrorCode.NotFound, ErrorCode.BadRequest]);
const isPermanent = (error: unknown): boolean =>
  error instanceof ErrorWithCode && PERMANENT_ERROR_CODES.has(error.code);

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
      const permanent = isPermanent(error);
      if (permanent || isFinalAttempt) {
        const reason = error instanceof Error ? error.message : String(error);
        await this.deps.searchRepo.markResultFailed(searchResultId, `${row.contact.bookingUrl}: ${reason}`);
      }
      if (permanent) return;
      throw error;
    }
  }
}
