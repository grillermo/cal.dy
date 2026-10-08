import type { PrismaClient } from "@calcom/prisma";
import type { LocalEventTypeLookup } from "../adapters/local";

export class VennEventTypeRepository implements LocalEventTypeLookup {
  constructor(private prismaClient: PrismaClient) {}

  async findLengthByUsernameAndSlug(username: string, slug: string): Promise<number | null> {
    const eventType = await this.prismaClient.eventType.findFirst({
      where: { slug, hidden: false, users: { some: { username } } },
      select: { length: true },
    });
    return eventType?.length ?? null;
  }
}
