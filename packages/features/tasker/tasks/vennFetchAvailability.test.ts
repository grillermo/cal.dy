import { beforeEach, describe, expect, it, vi } from "vitest";

const { run, isFinalAttempt } = vi.hoisted(() => ({
  run: vi.fn(async (_id: number, _opts: { isFinalAttempt: boolean }) => undefined),
  isFinalAttempt: vi.fn(async (_taskId?: string) => false),
}));

vi.mock("@calcom/features/venn/di/VennFetchAvailabilityService.container", () => ({
  getVennFetchAvailabilityService: () => ({ run }),
}));
vi.mock("../repository", () => ({ Task: { isFinalAttempt } }));

import { vennFetchAvailability } from "./vennFetchAvailability";

describe("vennFetchAvailability task handler", () => {
  beforeEach(() => {
    run.mockClear();
    isFinalAttempt.mockReset();
  });

  it("parses the payload and runs the service for that result", async () => {
    isFinalAttempt.mockResolvedValueOnce(false);
    await vennFetchAvailability(JSON.stringify({ searchResultId: 42 }), "task-1");
    expect(isFinalAttempt).toHaveBeenCalledWith("task-1");
    expect(run).toHaveBeenCalledWith(42, { isFinalAttempt: false });
  });

  it("passes isFinalAttempt through on the last attempt", async () => {
    isFinalAttempt.mockResolvedValueOnce(true);
    await vennFetchAvailability(JSON.stringify({ searchResultId: 42 }), "task-1");
    expect(run).toHaveBeenCalledWith(42, { isFinalAttempt: true });
  });

  it("rejects a malformed payload without calling the service", async () => {
    await expect(vennFetchAvailability(JSON.stringify({ searchResultId: "x" }), "task-1")).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it("propagates a service failure so the processor retries the task", async () => {
    isFinalAttempt.mockResolvedValueOnce(false);
    run.mockRejectedValueOnce(new Error("calendly down"));
    await expect(vennFetchAvailability(JSON.stringify({ searchResultId: 42 }), "task-1")).rejects.toThrow(
      "calendly down"
    );
  });
});
