import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/features/di/containers/AvailableSlots", () => ({ getAvailableSlotsService: vi.fn() }));

import { CalcomAdapter } from "./calcom";
import { CalendlyAdapter } from "./calendly";
import { getAdapter } from "./getAdapter";

describe("getAdapter", () => {
  const local = { fetchAvailability: async () => ({ durationMinutes: 30, freeIntervals: [] }) };
  it("maps each provider to its adapter", () => {
    expect(getAdapter("CALENDLY", { localAdapter: local })).toBeInstanceOf(CalendlyAdapter);
    expect(getAdapter("CALCOM", { localAdapter: local })).toBeInstanceOf(CalcomAdapter);
    expect(getAdapter("LOCAL", { localAdapter: local })).toBe(local);
  });
});
