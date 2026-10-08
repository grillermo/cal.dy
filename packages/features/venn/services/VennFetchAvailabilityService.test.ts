import { describe, expect, it, vi } from "vitest";
import { VennFetchAvailabilityService } from "./VennFetchAvailabilityService";

const row = {
  id: 5,
  search: { windowStart: new Date("2026-10-10T00:00:00Z"), windowEnd: new Date("2026-10-24T00:00:00Z") },
  contact: { id: 2, bookingUrl: "https://cal.com/bob/30min", provider: "CALCOM" as const },
};
const make = (adapterResult: unknown) => {
  const repo = {
    findResultForFetch: vi.fn(async () => row as typeof row | null),
    markResultDone: vi.fn(),
    markResultFailed: vi.fn(),
  };
  const adapter = {
    fetchAvailability: vi.fn(async () => {
      if (adapterResult instanceof Error) throw adapterResult;
      return adapterResult;
    }),
  };
  const service = new VennFetchAvailabilityService({
    searchRepo: repo as never,
    adapterFor: () => adapter as never,
  });
  return { repo, adapter, service };
};

describe("VennFetchAvailabilityService.run", () => {
  it("stores duration and serialized intervals on success", async () => {
    const { service, repo } = make({
      durationMinutes: 30,
      freeIntervals: [{ start: new Date("2026-10-12T10:00:00Z"), end: new Date("2026-10-12T11:00:00Z") }],
    });
    await service.run(5, { isFinalAttempt: false });
    expect(repo.markResultDone).toHaveBeenCalledWith(5, {
      durationMinutes: 30,
      freeIntervals: [{ start: "2026-10-12T10:00:00.000Z", end: "2026-10-12T11:00:00.000Z" }],
    });
  });

  it("stores DONE with no intervals when the contact has zero availability", async () => {
    const { service, repo } = make({ durationMinutes: 30, freeIntervals: [] });
    await service.run(5, { isFinalAttempt: false });
    expect(repo.markResultDone).toHaveBeenCalledWith(5, { durationMinutes: 30, freeIntervals: [] });
  });

  it("rethrows without marking FAILED on a non-final attempt", async () => {
    const { service, repo } = make(new Error("boom"));
    await expect(service.run(5, { isFinalAttempt: false })).rejects.toThrow("boom");
    expect(repo.markResultFailed).not.toHaveBeenCalled();
  });

  it("marks FAILED with a message naming the link on the final attempt", async () => {
    const { service, repo } = make(new Error("boom"));
    await expect(service.run(5, { isFinalAttempt: true })).rejects.toThrow("boom");
    expect(repo.markResultFailed).toHaveBeenCalledWith(
      5,
      expect.stringContaining("https://cal.com/bob/30min")
    );
  });

  it("is a no-op when the result row was already cleaned up", async () => {
    const { service, repo } = make({ durationMinutes: 30, freeIntervals: [] });
    repo.findResultForFetch.mockResolvedValueOnce(null);
    await expect(service.run(5, { isFinalAttempt: false })).resolves.toBeUndefined();
    expect(repo.markResultDone).not.toHaveBeenCalled();
  });
});
