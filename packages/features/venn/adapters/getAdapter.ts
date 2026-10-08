import process from "node:process";
import type { VennProviderKind } from "../types";
import { CalcomAdapter } from "./calcom";
import { CalendlyAdapter } from "./calendly";
import { FakeAdapter } from "./FakeAdapter";
import type { AvailabilityAdapter } from "./types";

// Both flags are required so a stray VENN_FAKE_ADAPTERS in a real deployment can never serve fabricated availability.
function shouldFakeAdapters(): boolean {
  return process.env.NEXT_PUBLIC_IS_E2E === "1" && process.env.VENN_FAKE_ADAPTERS === "1";
}

export function getAdapter(
  provider: VennProviderKind,
  deps: { localAdapter: AvailabilityAdapter }
): AvailabilityAdapter {
  switch (provider) {
    case "CALENDLY":
      return shouldFakeAdapters() ? new FakeAdapter() : new CalendlyAdapter();
    case "CALCOM":
      return shouldFakeAdapters() ? new FakeAdapter() : new CalcomAdapter();
    case "LOCAL":
      return deps.localAdapter;
  }
}
