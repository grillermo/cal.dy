import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/prisma", () => ({ prisma: {}, default: {}, readonlyPrisma: {} }));

describe("getVennContactService", () => {
  it("resolves the service with its dependency graph", async () => {
    const { getVennContactService } = await import("./VennContactService.container");
    const { VennContactService } = await import("../services/VennContactService");
    expect(getVennContactService()).toBeInstanceOf(VennContactService);
  });
});
