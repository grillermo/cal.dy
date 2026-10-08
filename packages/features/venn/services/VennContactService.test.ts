import { ErrorWithCode } from "@calcom/lib/errors";
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

describe("VennContactService write errors", () => {
  const valid = { name: "Ana", email: "ana@example.com", bookingUrl: "https://cal.com/ana/30min" };

  it("propagates repository errors on add", async () => {
    const { service, repo } = make();
    const conflict = ErrorWithCode.Factory.Conflict("duplicate");
    repo.create.mockRejectedValueOnce(conflict);
    await expect(service.add(7, valid)).rejects.toBe(conflict);
  });

  it("propagates repository errors on update", async () => {
    const { service, repo } = make();
    const notFound = ErrorWithCode.Factory.NotFound("missing");
    repo.update.mockRejectedValueOnce(notFound);
    await expect(service.update(7, 1, valid)).rejects.toBe(notFound);
  });
});
