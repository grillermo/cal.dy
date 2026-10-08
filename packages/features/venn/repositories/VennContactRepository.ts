import type { PrismaClient } from "@calcom/prisma";
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

  create(data: Omit<VennContactDto, "id"> & { userId: number }): Promise<VennContactDto> {
    return this.prismaClient.vennContact.create({ data, select });
  }

  update(id: number, userId: number, data: Partial<Omit<VennContactDto, "id">>): Promise<VennContactDto> {
    return this.prismaClient.vennContact.update({ where: { id, userId }, data, select });
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
}
