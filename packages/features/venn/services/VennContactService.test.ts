import { Prisma } from "@calcom/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { VennContactService } from "./VennContactService";

const adapter = { fetchAvailability: vi.fn(async () => ({ durationMinutes: 30, freeIntervals: [] })) };
const makeRepo = () => ({
  create: vi.fn(async (d) => ({
    id: 1,
    name: d.name,
    email: d.email,
    bookingUrl: d.bookingUrl,
    provider: d.provider,
  })),
  update: vi.fn(),
  delete: vi.fn(),
  findByUserId: vi.fn(async () => []),
  findManyByIdsAndUserId: vi.fn(),
});
const make = (repo = makeRepo()) => ({
  repo,
  service: new VennContactService({
    contactRepo: repo as never,
    adapterFor: () => adapter,
    localHost: "cal.example.com",
  }),
});

describe("VennContactService.add", () => {
  it("normalises the url, detects the provider and validates the link once", async () => {
    adapter.fetchAvailability.mockClear();
    const { service, repo } = make();
    await service.add(7, {
      name: "Ana",
      email: "Ana@Example.com",
      bookingUrl: "https://www.calendly.com/Ana/60min/?x=1",
    });
    expect(adapter.fetchAvailability).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith({
      userId: 7,
      name: "Ana",
      email: "ana@example.com",
      bookingUrl: "https://calendly.com/ana/60min",
      provider: "CALENDLY",
    });
  });

  it("rejects an unsupported link naming it", async () => {
    const { service } = make();
    await expect(
      service.add(7, { name: "X", email: "x@example.com", bookingUrl: "https://example.org/x/y" })
    ).rejects.toThrow("https://example.org/x/y");
  });

  it("rejects an invalid email", async () => {
    const { service } = make();
    await expect(
      service.add(7, { name: "X", email: "not-an-email", bookingUrl: "https://cal.com/x/y" })
    ).rejects.toThrow(/email/i);
  });

  it("rejects when the event is not found (adapter throws)", async () => {
    adapter.fetchAvailability.mockRejectedValueOnce(new Error("event not found for https://cal.com/x/y"));
    const { service, repo } = make();
    await expect(
      service.add(7, { name: "X", email: "x@example.com", bookingUrl: "https://cal.com/x/y" })
    ).rejects.toThrow("not found");
    expect(repo.create).not.toHaveBeenCalled();
  });
});

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test" });
const valid = { name: "Ana", email: "ana@example.com", bookingUrl: "https://cal.com/ana/30min" };

describe("VennContactService write errors", () => {
  it("maps a duplicate link (P2002) to a conflict naming the link", async () => {
    const { service, repo } = make();
    repo.create.mockRejectedValueOnce(prismaError("P2002"));
    await expect(service.add(7, valid)).rejects.toMatchObject({
      code: "conflict_error",
      message: expect.stringContaining("https://cal.com/ana/30min"),
    });
  });

  it("maps a duplicate link on update to a conflict", async () => {
    const { service, repo } = make();
    repo.update.mockRejectedValueOnce(prismaError("P2002"));
    await expect(service.update(7, 1, valid)).rejects.toMatchObject({ code: "conflict_error" });
  });

  it("maps a missing contact (P2025) to not found", async () => {
    const { service, repo } = make();
    repo.update.mockRejectedValueOnce(prismaError("P2025"));
    await expect(service.update(7, 99, valid)).rejects.toMatchObject({ code: "not_found_error" });
  });

  it("rethrows unknown errors untouched", async () => {
    const { service, repo } = make();
    const boom = new Error("db down");
    repo.create.mockRejectedValueOnce(boom);
    await expect(service.add(7, valid)).rejects.toBe(boom);
  });
});
