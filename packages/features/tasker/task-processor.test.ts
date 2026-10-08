import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/prisma", () => ({ prisma: {}, default: {} }));

import { TaskProcessor } from "./task-processor";

const LEASED_UNTIL = new Date("2026-10-01T00:03:00Z");
const EXTEND_BY_MS = 3 * 60 * 1000;

type Row = { id: string; type: string; payload: string; scheduledAt: Date; succeededAt: Date | null };

// In-memory compare-and-set mirroring TaskRepository.claimLeased: only the caller that still sees the original lease wins.
const makeRepo = (rows: Row[], now = new Date("2026-10-01T00:00:00Z")) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    getNextBatch: vi.fn(async () => rows),
    succeed: vi.fn(async (id: string) => {
      const row = byId.get(id);
      if (row) row.succeededAt = now;
    }),
    retry: vi.fn(async () => undefined),
    claimLeased: vi.fn(
      async ({
        taskId,
        type,
        leasedUntil,
        extendByMs,
      }: {
        taskId: string;
        type: string;
        leasedUntil: Date;
        extendByMs: number;
      }) => {
        const row = byId.get(taskId);
        if (!row || row.type !== type || row.succeededAt) return null;
        if (row.scheduledAt.getTime() !== leasedUntil.getTime()) return null;
        if (row.scheduledAt.getTime() <= now.getTime()) return null;
        row.scheduledAt = new Date(leasedUntil.getTime() + extendByMs);
        return { id: row.id, type: row.type, payload: row.payload };
      }
    ),
  };
};

const row = (id: string, type = "vennFetchAvailability"): Row => ({
  id,
  type,
  payload: JSON.stringify({ searchResultId: Number(id.replace(/\D/g, "")) || 1 }),
  scheduledAt: LEASED_UNTIL,
  succeededAt: null,
});

const makeProcessor = (rows: Row[]) => {
  const repo = makeRepo(rows);
  const vennHandler = vi.fn(async () => undefined);
  const otherHandler = vi.fn(async () => undefined);
  const handlers = {
    vennFetchAvailability: async () => vennHandler,
    sendWebhook: async () => otherHandler,
  };
  const processor = new TaskProcessor({ taskRepository: repo as never, handlers: handlers as never });
  return { processor, repo, vennHandler, otherHandler };
};

describe("TaskProcessor.processLeasedTasks", () => {
  it("runs exactly the given task ids and never reads the shared queue", async () => {
    const { processor, repo, vennHandler, otherHandler } = makeProcessor([
      row("t1"),
      row("t2"),
      row("t3"),
      row("w1", "sendWebhook"),
    ]);
    await processor.processLeasedTasks("vennFetchAvailability", ["t1", "t2"], {
      leasedUntil: LEASED_UNTIL,
      extendByMs: EXTEND_BY_MS,
    });
    expect(repo.getNextBatch).not.toHaveBeenCalled();
    expect(vennHandler).toHaveBeenCalledTimes(2);
    expect(vennHandler.mock.calls.map((c) => (c as unknown[])[1])).toEqual(["t1", "t2"]);
    expect(otherHandler).not.toHaveBeenCalled();
    expect(repo.succeed.mock.calls.map((c) => c[0])).toEqual(["t1", "t2"]);
  });

  it("does not run a task of another type even if its id is passed", async () => {
    const { processor, otherHandler, vennHandler } = makeProcessor([row("w1", "sendWebhook")]);
    await processor.processLeasedTasks("vennFetchAvailability", ["w1"], {
      leasedUntil: LEASED_UNTIL,
      extendByMs: EXTEND_BY_MS,
    });
    expect(otherHandler).not.toHaveBeenCalled();
    expect(vennHandler).not.toHaveBeenCalled();
  });

  it("runs a task only once when two runners race for the same id", async () => {
    const { processor, vennHandler } = makeProcessor([row("t1")]);
    const opts = { leasedUntil: LEASED_UNTIL, extendByMs: EXTEND_BY_MS };
    await Promise.all([
      processor.processLeasedTasks("vennFetchAvailability", ["t1"], opts),
      processor.processLeasedTasks("vennFetchAvailability", ["t1"], opts),
    ]);
    expect(vennHandler).toHaveBeenCalledTimes(1);
  });

  it("skips a task whose lease has expired (the cron may own it)", async () => {
    const expired = { ...row("t1"), scheduledAt: new Date("2026-09-30T23:59:00Z") };
    const { processor, vennHandler } = makeProcessor([expired]);
    await processor.processLeasedTasks("vennFetchAvailability", ["t1"], {
      leasedUntil: expired.scheduledAt,
      extendByMs: EXTEND_BY_MS,
    });
    expect(vennHandler).not.toHaveBeenCalled();
  });

  it("hands a failed run to retry() so the cron picks it up later", async () => {
    const { processor, repo, vennHandler } = makeProcessor([row("t1")]);
    vennHandler.mockRejectedValueOnce(new Error("calendly down"));
    await processor.processLeasedTasks("vennFetchAvailability", ["t1"], {
      leasedUntil: LEASED_UNTIL,
      extendByMs: EXTEND_BY_MS,
    });
    expect(repo.succeed).not.toHaveBeenCalled();
    expect(repo.retry).toHaveBeenCalledWith({
      taskId: "t1",
      lastError: "calendly down",
      minRetryIntervalMins: 1,
    });
  });
});
