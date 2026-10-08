import { Prisma } from "@calcom/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { VennContactRepository } from "./VennContactRepository";

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test" });
const make = (error: unknown) => {
  const vennContact = { create: vi.fn().mockRejectedValue(error), update: vi.fn().mockRejectedValue(error) };
  return new VennContactRepository({ vennContact } as never);
};
const data = {
  name: "Ana",
  email: "ana@example.com",
  bookingUrl: "https://cal.com/ana/30min",
  provider: "CAL_COM" as const,
};

describe("VennContactRepository write errors", () => {
  it("maps a duplicate link (P2002) to a conflict naming the link", async () => {
    await expect(make(prismaError("P2002")).create({ userId: 7, ...data })).rejects.toMatchObject({
      code: "conflict_error",
      message: expect.stringContaining(data.bookingUrl),
    });
    await expect(make(prismaError("P2002")).update(1, 7, data)).rejects.toMatchObject({
      code: "conflict_error",
    });
  });

  it("maps a missing contact (P2025) to not found", async () => {
    await expect(make(prismaError("P2025")).update(99, 7, data)).rejects.toMatchObject({
      code: "not_found_error",
    });
  });

  it("rethrows unknown errors untouched", async () => {
    const boom = new Error("db down");
    await expect(make(boom).create({ userId: 7, ...data })).rejects.toBe(boom);
    await expect(make(prismaError("P2003")).create({ userId: 7, ...data })).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError
    );
  });
});
