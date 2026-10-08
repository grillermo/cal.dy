import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVennSearch } from "./useVennSearch";

const startSearch = vi.fn();
const statusFetch = vi.fn();
const book = vi.fn();

vi.mock("@calcom/trpc/react", () => ({
  trpc: {
    useUtils: () => ({ viewer: { venn: { searchStatus: { fetch: statusFetch } } } }),
    viewer: {
      venn: {
        startSearch: { useMutation: () => ({ mutateAsync: startSearch, isPending: false }) },
        book: { useMutation: () => ({ mutateAsync: book, isPending: false }) },
      },
    },
  },
}));

const SEARCH_ID = "00000000-0000-4000-8000-000000000001";
const input = {
  contactIds: [1, 2],
  windowStart: new Date("2026-10-10T00:00:00Z"),
  windowEnd: new Date("2026-10-24T00:00:00Z"),
  timeZone: "UTC",
};

const ana = {
  contactId: 1,
  name: "Ana",
  provider: "CALENDLY",
  status: "DONE",
  durationMinutes: 60,
  error: null,
};
const bobPending = {
  contactId: 2,
  name: "Bob",
  provider: "CALCOM",
  status: "PENDING",
  durationMinutes: null,
  error: null,
};
const slots = { slots: { "2026-10-12": [{ time: "2026-10-12T15:00:00.000Z" }] } };

const pending = { status: "PENDING", participants: [ana, bobPending] };
const done = {
  status: "DONE",
  participants: [ana, { ...bobPending, status: "DONE", durationMinutes: 30 }],
  defaultDurationMinutes: 30,
  durationMinutes: 30,
  slots,
};

const conflict = (errorCode: string) =>
  Object.assign(new Error(errorCode), { data: { code: "CONFLICT", errorCode } });

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function startedHook() {
  const hook = renderHook(() => useVennSearch());
  await act(async () => {
    hook.result.current.start(input);
  });
  await flush();
  return hook;
}

describe("useVennSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startSearch.mockReset().mockResolvedValue({ searchId: SEARCH_ID });
    statusFetch.mockReset();
    book.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useVennSearch());
    expect(result.current.state.phase).toBe("idle");
  });

  it("calls startSearch then polls searchStatus every second until DONE", async () => {
    statusFetch.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValue(done);
    const { result } = await startedHook();

    expect(startSearch).toHaveBeenCalledWith(input);
    expect(statusFetch).toHaveBeenCalledTimes(1);
    expect(statusFetch.mock.calls[0][0]).toEqual({ searchId: SEARCH_ID, durationMinutes: undefined });
    expect(result.current.state.phase).toBe("polling");
    expect(result.current.state.participants).toHaveLength(2);

    await advance(1000);
    expect(statusFetch).toHaveBeenCalledTimes(2);
    expect(result.current.state.phase).toBe("polling");

    await advance(1000);
    expect(statusFetch).toHaveBeenCalledTimes(3);
    expect(result.current.state.phase).toBe("done");
    expect(result.current.state.slots).toEqual(slots);
    expect(result.current.state.defaultDurationMinutes).toBe(30);
    expect(result.current.state.durationMinutes).toBe(30);

    await advance(5000);
    expect(statusFetch).toHaveBeenCalledTimes(3);
  });

  it("moves to failed with the participant error and stops polling", async () => {
    statusFetch.mockResolvedValue({
      status: "FAILED",
      participants: [ana, { ...bobPending, status: "FAILED", error: "link not found" }],
    });
    const { result } = await startedHook();

    expect(result.current.state.phase).toBe("failed");
    expect(result.current.state.error).toContain("Bob");
    expect(result.current.state.error).toContain("link not found");
    expect(result.current.state.slots).toBeUndefined();

    await advance(5000);
    expect(statusFetch).toHaveBeenCalledTimes(1);
  });

  it("moves to timeout after 90 seconds of PENDING and retry restarts the search", async () => {
    statusFetch.mockResolvedValue(pending);
    const { result } = await startedHook();

    await advance(89_000);
    expect(result.current.state.phase).toBe("polling");
    await advance(1000);
    expect(result.current.state.phase).toBe("timeout");

    const callsAtTimeout = statusFetch.mock.calls.length;
    await advance(5000);
    expect(statusFetch).toHaveBeenCalledTimes(callsAtTimeout);

    statusFetch.mockResolvedValue(done);
    await act(async () => {
      result.current.retry();
    });
    await flush();
    expect(startSearch).toHaveBeenCalledTimes(2);
    expect(startSearch).toHaveBeenLastCalledWith(input);
    expect(result.current.state.phase).toBe("done");
  });

  it("setDuration refetches the status with the new duration without starting a new search", async () => {
    statusFetch.mockResolvedValue(done);
    const { result } = await startedHook();
    expect(result.current.state.phase).toBe("done");

    const sixty = { ...done, durationMinutes: 60, slots: { slots: {} } };
    statusFetch.mockResolvedValue(sixty);
    await act(async () => {
      result.current.setDuration(60);
    });
    await flush();

    expect(startSearch).toHaveBeenCalledTimes(1);
    expect(statusFetch).toHaveBeenLastCalledWith(
      { searchId: SEARCH_ID, durationMinutes: 60 },
      expect.anything()
    );
    expect(result.current.state.durationMinutes).toBe(60);
    expect(result.current.state.slots).toEqual({ slots: {} });
  });

  it("books with an ISO start and returns the uid", async () => {
    statusFetch.mockResolvedValue(done);
    book.mockResolvedValue({ uid: "abc" });
    const { result } = await startedHook();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.book({
        start: new Date("2026-10-12T15:00:00.000Z"),
        title: "Planning",
      });
    });

    expect(book).toHaveBeenCalledWith({
      searchId: SEARCH_ID,
      start: "2026-10-12T15:00:00.000Z",
      durationMinutes: 30,
      title: "Planning",
      timeZone: "UTC",
    });
    expect(outcome).toEqual({ uid: "abc" });
  });

  it("restarts the search with the same inputs when the booking says the search is stale", async () => {
    statusFetch.mockResolvedValue(done);
    book.mockRejectedValue(conflict("venn_search_stale"));
    const { result } = await startedHook();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.book({ start: new Date("2026-10-12T15:00:00Z"), title: "x" });
    });
    await flush();

    expect(outcome).toBeNull();
    expect(startSearch).toHaveBeenCalledTimes(2);
    expect(startSearch).toHaveBeenLastCalledWith(input);
    expect(result.current.state.notice).toBe("venn_search_stale");
  });

  it("refetches the status when the booking says the slot is taken", async () => {
    statusFetch.mockResolvedValue(done);
    book.mockRejectedValue(conflict("venn_slot_taken"));
    const { result } = await startedHook();
    const callsBefore = statusFetch.mock.calls.length;

    await act(async () => {
      await result.current.book({ start: new Date("2026-10-12T15:00:00Z"), title: "x" });
    });
    await flush();

    expect(startSearch).toHaveBeenCalledTimes(1);
    expect(statusFetch).toHaveBeenCalledTimes(callsBefore + 1);
    expect(result.current.state.notice).toBe("venn_slot_taken");
    expect(result.current.state.phase).toBe("done");
  });

  it("rethrows unknown booking errors", async () => {
    statusFetch.mockResolvedValue(done);
    book.mockRejectedValue(new Error("boom"));
    const { result } = await startedHook();

    await act(async () => {
      await expect(
        result.current.book({ start: new Date("2026-10-12T15:00:00Z"), title: "x" })
      ).rejects.toThrow("boom");
    });
  });

  it("moves to failed when startSearch rejects", async () => {
    startSearch.mockRejectedValue(new Error("One or more contacts were not found"));
    const { result } = await startedHook();
    expect(result.current.state.phase).toBe("failed");
    expect(result.current.state.error).toBe("One or more contacts were not found");
    expect(statusFetch).not.toHaveBeenCalled();
  });
});
