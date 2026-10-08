import { WEBAPP_URL } from "@calcom/lib/constants";
import { getAdapter } from "../adapters/getAdapter";
import { fetchLocalSlotsFromService, LocalAdapter } from "../adapters/local";
import type { AvailabilityAdapter } from "../adapters/types";
import type { VennEventTypeRepository } from "../repositories/VennEventTypeRepository";
import type { VennProviderKind } from "../types";

export const localHost = new URL(WEBAPP_URL).host;

export function buildAdapterFor(
  eventTypeRepo: VennEventTypeRepository
): (provider: VennProviderKind) => AvailabilityAdapter {
  const localAdapter = new LocalAdapter({
    lookup: eventTypeRepo,
    fetchSlots: fetchLocalSlotsFromService,
    localHost,
  });
  return (provider) => getAdapter(provider, { localAdapter });
}
