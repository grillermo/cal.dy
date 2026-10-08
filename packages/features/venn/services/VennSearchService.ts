import type { Tasker } from "@calcom/features/tasker/tasker";
import { ErrorWithCode } from "@calcom/lib/errors";
import logger from "@calcom/lib/logger";
import { type FetchLocalSlots, localSlotsToStarts } from "../adapters/local";
import { buildCandidateSlots, defaultDurationMinutes } from "../candidateSlots";
import { ALLOWED_DURATIONS, MAX_WINDOW_DAYS, SEARCH_TTL_MS, VENN_TASK_LEASE_MS } from "../constants";
import { deserializeIntervals, intersectAll, slotsToIntervals } from "../intervals";
import type { VennContactRepository } from "../repositories/VennContactRepository";
import type {
  VennSearchDto,
  VennSearchRepository,
  VennSearchStatus,
} from "../repositories/VennSearchRepository";
import type { VennProviderKind, VennSlots } from "../types";
import type { VennHiddenEventTypeService } from "./VennHiddenEventTypeService";

const log = logger.getSubLogger({ prefix: ["[venn]"] });
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface IVennSearchServiceDeps {
  searchRepo: VennSearchRepository;
  contactRepo: VennContactRepository;
  hiddenEventTypeService: VennHiddenEventTypeService;
  tasker: Pick<Tasker, "create">;
  /** Starts the given leased tasks in the background; startSearch never awaits it. */
  kick: (taskIds: string[], leasedUntil: Date) => Promise<void>;
  fetchSlots: FetchLocalSlots;
  now: () => Date;
}

export type StartSearchInput = { contactIds: number[]; windowStart: Date; windowEnd: Date; timeZone: string };

export type VennStatusResult = {
  status: VennSearchStatus;
  participants: {
    contactId: number;
    name: string;
    provider: VennProviderKind;
    status: VennSearchStatus;
    durationMinutes: number | null;
    error: string | null;
  }[];
  defaultDurationMinutes?: number;
  durationMinutes?: number;
  slots?: VennSlots;
};

export class VennSearchService {
  constructor(private deps: IVennSearchServiceDeps) {}

  async startSearch(userId: number, input: StartSearchInput): Promise<{ searchId: string }> {
    if (input.contactIds.length === 0) throw ErrorWithCode.Factory.BadRequest("Select at least one contact");
    if (input.windowEnd.getTime() <= input.windowStart.getTime()) {
      throw ErrorWithCode.Factory.BadRequest("windowEnd must be after windowStart");
    }
    if (input.windowEnd.getTime() - input.windowStart.getTime() > MAX_WINDOW_DAYS * MS_PER_DAY) {
      throw ErrorWithCode.Factory.BadRequest(`The search window can be at most ${MAX_WINDOW_DAYS} days`);
    }
    const ids = Array.from(new Set(input.contactIds));
    const owned = await this.deps.contactRepo.findManyByIdsAndUserId(ids, userId);
    if (owned.length !== ids.length)
      throw ErrorWithCode.Factory.NotFound("One or more contacts were not found");

    await this.deps.searchRepo.deleteOlderThan(new Date(this.deps.now().getTime() - SEARCH_TTL_MS));
    const { id, resultIds } = await this.deps.searchRepo.createSearchWithResults({
      userId,
      ...input,
      contactIds: ids,
    });
    const leasedUntil = new Date(this.deps.now().getTime() + VENN_TASK_LEASE_MS);
    const taskIds: string[] = [];
    try {
      for (const searchResultId of resultIds) {
        taskIds.push(
          await this.deps.tasker.create(
            "vennFetchAvailability",
            { searchResultId },
            { maxAttempts: 3, scheduledAt: leasedUntil }
          )
        );
      }
    } catch (error) {
      // Rows without a task would stay PENDING until the 24h cleanup, so fail the search now.
      await this.deps.searchRepo.setStatus(id, "FAILED");
      throw error;
    }
    this.kickInBackground(taskIds, leasedUntil);
    return { searchId: id };
  }

  // Rows and tasks are committed, so a failed kick only delays the fetch: the cron runs the tasks once the lease ends.
  private kickInBackground(taskIds: string[], leasedUntil: Date): void {
    try {
      void this.deps.kick(taskIds, leasedUntil).catch((error) => log.warn("Venn task kick failed", error));
    } catch (error) {
      log.warn("Could not kick venn tasks", error);
    }
  }

  async searchStatus(
    userId: number,
    input: { searchId: string; durationMinutes?: number }
  ): Promise<VennStatusResult> {
    const search = await this.deps.searchRepo.findByIdAndUserId(input.searchId, userId);
    if (!search) throw ErrorWithCode.Factory.NotFound("Search not found");

    const contacts = await this.deps.contactRepo.findManyByIdsAndUserId(search.contactIds, userId);
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const participants = search.results.map((r) => {
      const contact = byId.get(r.contactId);
      return {
        contactId: r.contactId,
        name: contact?.name ?? "Unknown contact",
        provider: contact?.provider ?? ("CALENDLY" as VennProviderKind),
        status: r.status,
        durationMinutes: r.durationMinutes,
        error: r.error,
      };
    });

    if (search.results.some((r) => r.status === "FAILED")) {
      await this.deps.searchRepo.setStatus(search.id, "FAILED");
      return { status: "FAILED", participants };
    }
    if (search.results.some((r) => r.status === "PENDING")) {
      return { status: "PENDING", participants };
    }

    const defaultDuration = defaultDurationMinutes(search.results.map((r) => r.durationMinutes ?? 30));
    const durationMinutes = input.durationMinutes ?? defaultDuration;
    const slots = await this.computeCandidateSlots(userId, search, durationMinutes);
    return { status: "DONE", participants, defaultDurationMinutes: defaultDuration, durationMinutes, slots };
  }

  async computeCandidateSlots(
    userId: number,
    search: VennSearchDto,
    durationMinutes: number
  ): Promise<VennSlots> {
    if (!(ALLOWED_DURATIONS as readonly number[]).includes(durationMinutes)) {
      throw ErrorWithCode.Factory.BadRequest(`Unsupported duration: ${durationMinutes} minutes`);
    }
    const hidden = await this.deps.hiddenEventTypeService.getOrCreate(userId);
    const organizer = await this.deps.fetchSlots({
      eventTypeId: hidden.id,
      startTime: search.windowStart.toISOString(),
      endTime: search.windowEnd.toISOString(),
      duration: durationMinutes,
    });
    const lists = [
      slotsToIntervals(localSlotsToStarts(organizer.slots), durationMinutes),
      ...search.results.map((r) => deserializeIntervals(r.freeIntervals ?? [])),
    ];
    return buildCandidateSlots({
      intervals: intersectAll(lists),
      durationMinutes,
      now: this.deps.now(),
      timeZone: search.timeZone,
    });
  }
}
