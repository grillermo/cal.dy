import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VennSearchState } from "../hooks/useVennSearch";
import VennView from "./venn-view";

const push = vi.fn();
const start = vi.fn();
const retry = vi.fn();
const setDuration = vi.fn();
const book = vi.fn();
const add = vi.fn();
let state: VennSearchState = { phase: "idle", participants: [] };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: "en" },
  }),
}));

vi.mock("@calcom/features/bookings/Booker/BookerStoreProvider", () => ({
  BookerStoreProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@calcom/features/calendars/components/DatePicker", () => ({
  DatePicker: ({
    includedDates,
    onChange,
  }: {
    includedDates: string[];
    onChange: (date: { format: () => string }) => void;
  }) => (
    <div>
      {includedDates.map((day) => (
        <button key={day} type="button" onClick={() => onChange({ format: () => day })}>
          {`day-${day}`}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../hooks/useVennContacts", () => ({
  useVennContacts: () => ({
    contacts: [
      {
        id: 1,
        name: "Ana",
        email: "ana@example.com",
        bookingUrl: "https://calendly.com/ana/60",
        provider: "CALENDLY",
      },
      {
        id: 2,
        name: "Bob",
        email: "bob@example.com",
        bookingUrl: "https://cal.com/bob/30",
        provider: "CALCOM",
      },
    ],
    add,
    isLoading: false,
  }),
}));

vi.mock("../hooks/useVennSearch", () => ({
  useVennSearch: () => ({ state, start, retry, setDuration, book, isBooking: false }),
}));

const ana = {
  contactId: 1,
  name: "Ana",
  provider: "CALENDLY" as const,
  status: "DONE" as const,
  durationMinutes: 60,
  error: null,
};
const bob = {
  contactId: 2,
  name: "Bob",
  provider: "CALCOM" as const,
  status: "PENDING" as const,
  durationMinutes: null,
  error: null,
};

describe("VennView", () => {
  beforeEach(() => {
    for (const fn of [push, start, retry, setDuration, book, add]) fn.mockReset();
    state = { phase: "idle", participants: [] };
  });

  it("idle: starts a search with the selected contacts", () => {
    render(<VennView />);
    const findTimes = screen.getByTestId("venn-find-times");
    expect(findTimes).toBeDisabled();

    fireEvent.click(screen.getByTestId("venn-contact-checkbox-ana@example.com"));
    fireEvent.click(screen.getByTestId("venn-contact-checkbox-bob@example.com"));
    fireEvent.click(findTimes);

    expect(start).toHaveBeenCalledTimes(1);
    const input = start.mock.calls[0][0];
    expect(input.contactIds).toEqual([1, 2]);
    expect(input.windowEnd.getTime() - input.windowStart.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    expect(typeof input.timeZone).toBe("string");
  });

  it("polling: shows the fetching message and per-participant status", () => {
    state = { phase: "polling", participants: [ana, bob] };
    render(<VennView />);
    expect(screen.getByText("venn_fetching")).toBeInTheDocument();
    const rows = screen.getAllByTestId("venn-participant");
    expect(rows[0]).toHaveTextContent("Ana");
    expect(rows[0]).toHaveTextContent('venn_participant_done:{"provider":"Calendly","minutes":60}');
    expect(rows[1]).toHaveTextContent("Bob");
    expect(rows[1]).toHaveTextContent("venn_participant_fetching");
    expect(screen.queryByTestId("venn-slot")).not.toBeInTheDocument();
  });

  it("done with slots: picks a slot and books it, then navigates to the booking", async () => {
    state = {
      phase: "done",
      participants: [ana, { ...bob, status: "DONE", durationMinutes: 30 }],
      durationMinutes: 30,
      defaultDurationMinutes: 30,
      slots: {
        slots: {
          "2026-10-12": [{ time: "2026-10-12T15:00:00.000Z" }, { time: "2026-10-12T16:00:00.000Z" }],
          "2026-10-13": [{ time: "2026-10-13T09:00:00.000Z" }],
        },
      },
    };
    book.mockResolvedValue({ uid: "booking-uid" });
    render(<VennView />);

    const slots = screen.getAllByTestId("venn-slot");
    expect(slots).toHaveLength(2);
    expect(screen.getByTestId("venn-book")).toBeDisabled();

    fireEvent.click(screen.getByText("day-2026-10-13"));
    expect(screen.getAllByTestId("venn-slot")).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId("venn-slot")[0]);
    fireEvent.change(screen.getByTestId("venn-title"), { target: { value: "Planning" } });
    fireEvent.click(screen.getByTestId("venn-book"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/booking/booking-uid"));
    expect(book).toHaveBeenCalledWith({ start: new Date("2026-10-13T09:00:00.000Z"), title: "Planning" });
  });

  it("done with slots: changing the duration calls setDuration", () => {
    state = {
      phase: "done",
      participants: [ana],
      durationMinutes: 30,
      slots: { slots: { "2026-10-12": [{ time: "2026-10-12T15:00:00.000Z" }] } },
    };
    render(<VennView />);
    fireEvent.change(screen.getByTestId("venn-duration"), { target: { value: "60" } });
    expect(setDuration).toHaveBeenCalledWith(60);
  });

  it("shows the booking error message when booking fails for another reason", async () => {
    state = {
      phase: "done",
      participants: [ana],
      durationMinutes: 30,
      slots: { slots: { "2026-10-12": [{ time: "2026-10-12T15:00:00.000Z" }] } },
    };
    book.mockRejectedValue(new Error("Booking limit reached"));
    render(<VennView />);
    fireEvent.click(screen.getAllByTestId("venn-slot")[0]);
    fireEvent.click(screen.getByTestId("venn-book"));
    expect(await screen.findByText("Booking limit reached")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("failed: names the failing contact with its error and shows no slots", () => {
    state = {
      phase: "failed",
      participants: [ana, { ...bob, status: "FAILED", error: "link not found" }],
      error: "Bob: link not found",
    };
    render(<VennView />);
    expect(screen.getByTestId("venn-search-failed")).toHaveTextContent("venn_search_failed");
    const failed = screen.getAllByTestId("venn-participant")[1];
    expect(failed).toHaveTextContent("Bob");
    expect(failed).toHaveTextContent("link not found");
    expect(screen.queryByTestId("venn-slot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("venn-book")).not.toBeInTheDocument();
  });

  it("no common time: shows the message with duration and window controls", () => {
    state = { phase: "done", participants: [ana], durationMinutes: 60, slots: { slots: {} } };
    render(<VennView />);
    expect(screen.getByText("venn_no_common_time")).toBeInTheDocument();
    expect(screen.getByTestId("venn-duration")).toBeInTheDocument();
    expect(screen.getByTestId("venn-window-no-common-time")).toBeInTheDocument();
    expect(screen.queryByTestId("venn-book")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("venn-window-no-common-time"), { target: { value: "31" } });
    expect(start).toHaveBeenCalledTimes(1);
    const input = start.mock.calls[0][0];
    expect(input.windowEnd.getTime() - input.windowStart.getTime()).toBe(31 * 24 * 60 * 60 * 1000);
  });

  it("timeout: shows the timeout message and retries", () => {
    state = { phase: "timeout", participants: [ana, bob] };
    render(<VennView />);
    expect(screen.getByText("venn_timeout")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("venn-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the stale/slot-taken notice", () => {
    state = { phase: "polling", participants: [], notice: "venn_search_stale" };
    render(<VennView />);
    expect(screen.getByTestId("venn-notice")).toHaveTextContent("venn_search_stale");
  });
});
