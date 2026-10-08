import type { PrismaClient } from "@calcom/prisma";

export class VennSearchRepository {
  constructor(private prismaClient: PrismaClient) {}
}
