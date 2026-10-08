import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VennParticipantStatus } from "./VennParticipantStatus";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

describe("VennParticipantStatus", () => {
  it("shows a contact deleted mid-search as failed, with no provider", () => {
    render(
      <VennParticipantStatus
        participants={[
          {
            contactId: 2,
            name: "Removed contact",
            provider: null,
            status: "FAILED",
            durationMinutes: null,
            error: "contact removed",
          },
        ]}
      />
    );
    const row = screen.getByTestId("venn-participant");
    expect(row).toHaveAttribute("data-status", "FAILED");
    expect(row).toHaveTextContent("Removed contact");
    expect(row).toHaveTextContent("contact removed");
  });
});
