import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@calcom/features/di/containers/AvailableSlots", () => ({ getAvailableSlotsService: vi.fn() }));

import { CalcomAdapter } from "./calcom";
import { CalendlyAdapter } from "./calendly";
import { FakeAdapter } from "./FakeAdapter";
import { getAdapter } from "./getAdapter";

describe("getAdapter", () => {
  const local = { fetchAvailability: async () => ({ durationMinutes: 30, freeIntervals: [] }) };
  it("maps each provider to its adapter", () => {
    expect(getAdapter("CALENDLY", { localAdapter: local })).toBeInstanceOf(CalendlyAdapter);
    expect(getAdapter("CALCOM", { localAdapter: local })).toBeInstanceOf(CalcomAdapter);
    expect(getAdapter("LOCAL", { localAdapter: local })).toBe(local);
  });

  describe("fake adapter guard", () => {
    afterEach(() => vi.unstubAllEnvs());
    const set = (e2e?: string, fake?: string) => {
      vi.stubEnv("NEXT_PUBLIC_IS_E2E", e2e ?? "");
      vi.stubEnv("VENN_FAKE_ADAPTERS", fake ?? "");
    };

    it("uses the fake adapter only when both flags are 1", () => {
      set("1", "1");
      expect(getAdapter("CALENDLY", { localAdapter: local })).toBeInstanceOf(FakeAdapter);
      expect(getAdapter("CALCOM", { localAdapter: local })).toBeInstanceOf(FakeAdapter);
      expect(getAdapter("LOCAL", { localAdapter: local })).toBe(local);
    });

    it.each([
      ["1", ""],
      ["", "1"],
      ["", ""],
      ["0", "1"],
    ])("uses real adapters when NEXT_PUBLIC_IS_E2E=%j and VENN_FAKE_ADAPTERS=%j", (e2e, fake) => {
      set(e2e, fake);
      expect(getAdapter("CALENDLY", { localAdapter: local })).toBeInstanceOf(CalendlyAdapter);
      expect(getAdapter("CALCOM", { localAdapter: local })).toBeInstanceOf(CalcomAdapter);
    });
  });
});
