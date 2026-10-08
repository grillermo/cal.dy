import { ErrorWithCode } from "@calcom/lib/errors";
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

  it.each([
    ["NotFound", ErrorWithCode.Factory.NotFound("event not found")],
    ["BadRequest", ErrorWithCode.Factory.BadRequest("not a supported link")],
  ])("marks a permanent %s error FAILED on the first attempt and completes without retrying", async (_, error) => {
    const { service, repo } = make(error);
    await expect(service.run(5, { isFinalAttempt: false })).resolves.toBeUndefined();
    expect(repo.markResultFailed).toHaveBeenCalledWith(5, `https://cal.com/bob/30min: ${error.message}`);
  });

  it("retries a transient ErrorWithCode (e.g. provider unreachable) on a non-final attempt", async () => {
    const { service, repo } = make(ErrorWithCode.Factory.InternalServerError("could not reach"));
    await expect(service.run(5, { isFinalAttempt: false })).rejects.toThrow("could not reach");
    expect(repo.markResultFailed).not.toHaveBeenCalled();
  });

  it("marks the result FAILED when the contact was deleted after the search started", async () => {
    const { service, repo, adapter } = make({ durationMinutes: 30, freeIntervals: [] });
    repo.findResultForFetch.mockResolvedValueOnce({ ...row, contact: null } as never);
    await expect(service.run(5, { isFinalAttempt: false })).resolves.toBeUndefined();
    expect(repo.markResultFailed).toHaveBeenCalledWith(5, "contact removed");
    expect(adapter.fetchAvailability).not.toHaveBeenCalled();
  });

  it("is a no-op when the result row was already cleaned up", async () => {
    const { service, repo } = make({ durationMinutes: 30, freeIntervals: [] });
    repo.findResultForFetch.mockResolvedValueOnce(null);
    await expect(service.run(5, { isFinalAttempt: false })).resolves.toBeUndefined();
    expect(repo.markResultDone).not.toHaveBeenCalled();
    expect(repo.markResultFailed).not.toHaveBeenCalled();
  });
});
