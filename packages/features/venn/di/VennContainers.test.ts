import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/prisma", () => ({ prisma: {}, default: {}, readonlyPrisma: {} }));

describe("venn DI containers", () => {
  it("resolves VennSearchService with its dependency graph", async () => {
    const { getVennSearchService } = await import("./VennSearchService.container");
    const { VennSearchService } = await import("../services/VennSearchService");
    expect(getVennSearchService()).toBeInstanceOf(VennSearchService);
  });

  it("resolves VennFetchAvailabilityService with its dependency graph", async () => {
    const { getVennFetchAvailabilityService } = await import("./VennFetchAvailabilityService.container");
    const { VennFetchAvailabilityService } = await import("../services/VennFetchAvailabilityService");
    expect(getVennFetchAvailabilityService()).toBeInstanceOf(VennFetchAvailabilityService);
  });

  it("resolves VennBookingService with its dependency graph, including RegularBookingService", async () => {
    const { getVennBookingService } = await import("./VennBookingService.container");
    const { VennBookingService } = await import("../services/VennBookingService");
    expect(getVennBookingService()).toBeInstanceOf(VennBookingService);
    // Importing the RegularBookingService graph alone takes several seconds.
  }, 60_000);
});
