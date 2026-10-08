import { ErrorWithCode } from "@calcom/lib/errors";
import { z } from "zod";
import type { AvailabilityAdapter } from "../adapters/types";
import { parseBookingUrl } from "../links/parseBookingUrl";
import type { VennContactDto, VennContactRepository } from "../repositories/VennContactRepository";
import type { VennProviderKind } from "../types";

export interface IVennContactServiceDeps {
  contactRepo: VennContactRepository;
  adapterFor: (provider: VennProviderKind) => AvailabilityAdapter;
  localHost: string;
}

const inputSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email({ message: "Invalid email" }),
  bookingUrl: z.string().trim().min(1),
});

export class VennContactService {
  constructor(private deps: IVennContactServiceDeps) {}

  list(userId: number) {
    return this.deps.contactRepo.findByUserId(userId);
  }

  async add(userId: number, input: z.input<typeof inputSchema>): Promise<VennContactDto> {
    const data = await this.validate(input);
    return this.deps.contactRepo.create({ userId, ...data });
  }

  async update(userId: number, id: number, input: z.input<typeof inputSchema>): Promise<VennContactDto> {
    const data = await this.validate(input);
    return this.deps.contactRepo.update(id, userId, data);
  }

  remove(userId: number, id: number) {
    return this.deps.contactRepo.delete(id, userId);
  }

  private async validate(input: z.input<typeof inputSchema>) {
    const parsedInput = inputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw ErrorWithCode.Factory.BadRequest(parsedInput.error.issues.map((i) => i.message).join(", "));
    }
    const { name, email, bookingUrl } = parsedInput.data;
    const parsed = parseBookingUrl(bookingUrl, this.deps.localHost);
    if (!parsed) {
      throw ErrorWithCode.Factory.BadRequest(`Unsupported booking link: ${bookingUrl}`);
    }
    // One cheap fetch proves the event exists before we store it.
    const today = new Date();
    await this.deps.adapterFor(parsed.provider).fetchAvailability({
      url: parsed.normalizedUrl,
      start: today,
      end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    });
    return { name, email, bookingUrl: parsed.normalizedUrl, provider: parsed.provider };
  }
}
