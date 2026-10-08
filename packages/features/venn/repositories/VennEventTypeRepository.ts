import type { PrismaClient } from "@calcom/prisma";
import { Prisma } from "@calcom/prisma/client";
import type { LocalEventTypeLookup } from "../adapters/local";
import { HIDDEN_EVENT_SLUG } from "../constants";

export class VennEventTypeRepository implements LocalEventTypeLookup {
  constructor(private prismaClient: PrismaClient) {}

  async findLengthByUsernameAndSlug(username: string, slug: string): Promise<number | null> {
    const eventType = await this.prismaClient.eventType.findFirst({
      where: { slug, hidden: false, users: { some: { username } } },
      select: { length: true },
    });
    return eventType?.length ?? null;
  }

  findHiddenByUserId(userId: number): Promise<{ id: number } | null> {
    return this.prismaClient.eventType.findFirst({
      where: { userId, slug: HIDDEN_EVENT_SLUG },
      select: { id: true },
    });
  }

  async createHidden(
    userId: number,
    data: {
      title: string;
      slug: string;
      length: number;
      eventName: string | null;
      metadata: { multipleDuration: number[] };
      bookingFields: Prisma.InputJsonValue;
    }
  ): Promise<{ id: number }> {
    try {
      return await this.prismaClient.eventType.create({
        data: {
          ...data,
          hidden: true,
          owner: { connect: { id: userId } },
          users: { connect: { id: userId } },
        },
        select: { id: true },
      });
    } catch (error) {
      // A concurrent getOrCreate won the [userId, slug] unique constraint; reuse its row.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await this.findHiddenByUserId(userId);
      if (!existing) throw error;
      return existing;
    }
  }
}
