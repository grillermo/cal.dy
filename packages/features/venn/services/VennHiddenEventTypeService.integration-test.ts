import prisma from "@calcom/prisma";
import { afterAll, describe, expect, it } from "vitest";
import { HIDDEN_EVENT_SLUG } from "../constants";
import { VennEventTypeRepository } from "../repositories/VennEventTypeRepository";
import { VennHiddenEventTypeService } from "./VennHiddenEventTypeService";

const createdUserIds: number[] = [];

describe("VennHiddenEventTypeService (integration)", () => {
  afterAll(async () => {
    await prisma.eventType.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("creates exactly one hidden event type per user across repeated calls", async () => {
    const stamp = Date.now();
    const user = await prisma.user.create({
      data: { email: `venn-test-${stamp}@example.com`, username: `venn-test-${stamp}` },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    const service = new VennHiddenEventTypeService({ eventTypeRepo: new VennEventTypeRepository(prisma) });
    const [a, b] = await Promise.all([service.getOrCreate(user.id), service.getOrCreate(user.id)]);
    const again = await service.getOrCreate(user.id);
    const rows = await prisma.eventType.findMany({
      where: { userId: user.id, slug: HIDDEN_EVENT_SLUG },
      select: { id: true, hidden: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].hidden).toBe(true);
    expect([a.id, b.id, again.id].every((id) => id === rows[0].id)).toBe(true);
  });
});
