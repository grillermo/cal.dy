import type { VennProviderKind } from "../types";
import { CalcomAdapter } from "./calcom";
import { CalendlyAdapter } from "./calendly";
import type { AvailabilityAdapter } from "./types";

export function getAdapter(
  provider: VennProviderKind,
  deps: { localAdapter: AvailabilityAdapter }
): AvailabilityAdapter {
  switch (provider) {
    case "CALENDLY":
      return new CalendlyAdapter();
    case "CALCOM":
      return new CalcomAdapter();
    case "LOCAL":
      return deps.localAdapter;
  }
}
