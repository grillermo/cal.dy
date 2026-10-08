import type { PrismaClient } from "@calcom/prisma";
import type { VennProviderKind } from "../types";

export type VennSearchStatus = "PENDING" | "DONE" | "FAILED";

export type VennSearchDto = {
  id: string;
  userId: number;
  contactIds: number[];
  windowStart: Date;
  windowEnd: Date;
  timeZone: string;
  results: {
    id: number;
    contactId: number;
    status: VennSearchStatus;
    durationMinutes: number | null;
    freeIntervals: unknown;
    error: string | null;
    fetchedAt: Date | null;
  }[];
};

export class VennSearchRepository {
  constructor(private prismaClient: PrismaClient) {}

  // VennSearchResult has no relation to VennContact (bare contactId), so the contact is a second lookup and is
  // null when the contact was deleted after the search started.
  async findResultForFetch(id: number): Promise<{
    id: number;
    search: { windowStart: Date; windowEnd: Date };
    contact: { id: number; bookingUrl: string; provider: VennProviderKind } | null;
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

  async createSearchWithResults(data: {
    userId: number;
    contactIds: number[];
    windowStart: Date;
    windowEnd: Date;
    timeZone: string;
  }): Promise<{ id: string; resultIds: number[] }> {
    const search = await this.prismaClient.vennSearch.create({
      data: {
        userId: data.userId,
        contactIds: data.contactIds,
        windowStart: data.windowStart,
        windowEnd: data.windowEnd,
        timeZone: data.timeZone,
        results: { create: data.contactIds.map((contactId) => ({ contactId })) },
      },
      select: { id: true, results: { select: { id: true }, orderBy: { id: "asc" } } },
    });
    return { id: search.id, resultIds: search.results.map((r) => r.id) };
  }

  findByIdAndUserId(id: string, userId: number): Promise<VennSearchDto | null> {
    return this.prismaClient.vennSearch.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        contactIds: true,
        windowStart: true,
        windowEnd: true,
        timeZone: true,
        results: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            contactId: true,
            status: true,
            durationMinutes: true,
            freeIntervals: true,
            error: true,
            fetchedAt: true,
          },
        },
      },
    });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const { count } = await this.prismaClient.vennSearch.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return count;
  }

  async setStatus(id: string, status: VennSearchStatus): Promise<void> {
    await this.prismaClient.vennSearch.update({ where: { id }, data: { status } });
  }
}
