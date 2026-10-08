import { ErrorWithCode } from "@calcom/lib/errors";
import type { PrismaClient } from "@calcom/prisma";
import { Prisma } from "@calcom/prisma/client";
import type { VennProviderKind } from "../types";

export type VennContactDto = {
  id: number;
  name: string;
  email: string;
  bookingUrl: string;
  provider: VennProviderKind;
};

const select = { id: true, name: true, email: true, bookingUrl: true, provider: true } as const;

export class VennContactRepository {
  constructor(private prismaClient: PrismaClient) {}

  async create(data: Omit<VennContactDto, "id"> & { userId: number }): Promise<VennContactDto> {
    try {
      return await this.prismaClient.vennContact.create({ data, select });
    } catch (error) {
      throw this.mapWriteError(error, data.bookingUrl);
    }
  }

  async update(
    id: number,
    userId: number,
    data: Partial<Omit<VennContactDto, "id">>
  ): Promise<VennContactDto> {
    try {
      return await this.prismaClient.vennContact.update({ where: { id, userId }, data, select });
    } catch (error) {
      throw this.mapWriteError(error, data.bookingUrl);
    }
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.prismaClient.vennContact.deleteMany({ where: { id, userId } });
  }

  findByUserId(userId: number): Promise<VennContactDto[]> {
    return this.prismaClient.vennContact.findMany({ where: { userId }, orderBy: { name: "asc" }, select });
  }

  findManyByIdsAndUserId(ids: number[], userId: number): Promise<VennContactDto[]> {
    return this.prismaClient.vennContact.findMany({ where: { id: { in: ids }, userId }, select });
  }

  private mapWriteError(error: unknown, bookingUrl?: string) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
    if (error.code === "P2002") {
      return ErrorWithCode.Factory.Conflict(`You already have a contact with the link ${bookingUrl}`);
    }
    if (error.code === "P2025") return ErrorWithCode.Factory.NotFound("Contact not found");
    return error;
  }
}
