import type { PrismaClient } from "@calcom/prisma";
import type { VennProviderKind } from "../types";

export class VennSearchRepository {
  constructor(private prismaClient: PrismaClient) {}

  // VennSearchResult has no relation to VennContact (bare contactId), so the contact is a second lookup.
  async findResultForFetch(id: number): Promise<{
    id: number;
    search: { windowStart: Date; windowEnd: Date };
    contact: { id: number; bookingUrl: string; provider: VennProviderKind };
  } | null> {
    const result = await this.prismaClient.vennSearchResult.findUnique({
      where: { id },
      select: {
        id: true,
        contactId: true,
        search: { select: { windowStart: true, windowEnd: true } },
      },
    });
    if (!result) return null;

    const contact = await this.prismaClient.vennContact.findUnique({
      where: { id: result.contactId },
      select: { id: true, bookingUrl: true, provider: true },
    });
    if (!contact) return null;

    return { id: result.id, search: result.search, contact };
  }

  async markResultDone(
    id: number,
    data: { durationMinutes: number; freeIntervals: { start: string; end: string }[] }
  ): Promise<void> {
    await this.prismaClient.vennSearchResult.update({
      where: { id },
      data: {
        status: "DONE",
        durationMinutes: data.durationMinutes,
        freeIntervals: data.freeIntervals,
        fetchedAt: new Date(),
        error: null,
      },
    });
  }

  async markResultFailed(id: number, error: string): Promise<void> {
    await this.prismaClient.vennSearchResult.update({
      where: { id },
      data: { status: "FAILED", error, fetchedAt: new Date() },
    });
  }
}
