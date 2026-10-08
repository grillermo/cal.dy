import prisma from "@calcom/prisma";
import { afterAll, describe, expect, it } from "vitest";
import { TaskRepository } from "./repository";

const stamp = Date.now();
const repo = new TaskRepository({ prismaClient: prisma });
const createdIds: string[] = [];
const EXTEND_BY_MS = 3 * 60 * 1000;

const createLeased = async (
  leasedUntil: Date,
  type: "vennFetchAvailability" | "sendWebhook" = "vennFetchAvailability"
) => {
  const id = await repo.create(type, JSON.stringify({ searchResultId: 1 }), {
    scheduledAt: leasedUntil,
    referenceUid: `venn-test-${stamp}-${createdIds.length}`,
  });
  createdIds.push(id);
  return id;
};

describe("TaskRepository.claimLeased (integration)", () => {
  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("lets exactly one of many concurrent claimers win and hides the row from getNextBatch", async () => {
    const leasedUntil = new Date(Date.now() + 60_000);
    const taskId = await createLeased(leasedUntil);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repo.claimLeased({ taskId, type: "vennFetchAvailability", leasedUntil, extendByMs: EXTEND_BY_MS })
      )
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const row = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { scheduledAt: true } });
    expect(row.scheduledAt.getTime()).toBe(leasedUntil.getTime() + EXTEND_BY_MS);
    const batch = await repo.getNextBatch();
    expect(batch.some((t) => t.id === taskId)).toBe(false);
  });

  it("refuses a task whose lease already expired", async () => {
    const leasedUntil = new Date(Date.now() - 1000);
    const taskId = await createLeased(leasedUntil);
    expect(
      await repo.claimLeased({ taskId, type: "vennFetchAvailability", leasedUntil, extendByMs: EXTEND_BY_MS })
    ).toBeNull();
  });

  it("refuses a task of another type", async () => {
    const leasedUntil = new Date(Date.now() + 60_000);
    const taskId = await createLeased(leasedUntil, "sendWebhook");
    expect(
      await repo.claimLeased({ taskId, type: "vennFetchAvailability", leasedUntil, extendByMs: EXTEND_BY_MS })
    ).toBeNull();
  });

  it("refuses a task that already succeeded", async () => {
    const leasedUntil = new Date(Date.now() + 60_000);
    const taskId = await createLeased(leasedUntil);
    await repo.succeed(taskId);
    expect(
      await repo.claimLeased({ taskId, type: "vennFetchAvailability", leasedUntil, extendByMs: EXTEND_BY_MS })
    ).toBeNull();
  });
});
