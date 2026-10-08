import type { RouterInputs, RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 90_000;
// A single dropped request (deploy, flaky network) should not fail a search that is still running on the server.
const MAX_CONSECUTIVE_POLL_ERRORS = 2;

type VennStatus = RouterOutputs["viewer"]["venn"]["searchStatus"];
type Timer = ReturnType<typeof setTimeout>;

const IDLE: VennSearchState = { phase: "idle", participants: [] };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function conflictCode(error: unknown): VennNotice | null {
  if (typeof error !== "object" || error === null || !("data" in error)) return null;
  const { data } = error as { data?: { code?: unknown; errorCode?: unknown } };
  if (data?.code !== "CONFLICT") return null;
  if (data.errorCode === "venn_search_stale" || data.errorCode === "venn_slot_taken") return data.errorCode;
  return null;
}

function failureText(participants: VennParticipant[]): string | undefined {
  const failed = participants.filter((p) => p.status === "FAILED");
  if (failed.length === 0) return undefined;
  return failed.map((p) => `${p.name}: ${p.error ?? ""}`.trim()).join("; ");
}

function applyStatus(state: VennSearchState, result: VennStatus): VennSearchState {
  const participants = result.participants;
  if (result.status === "PENDING") return { ...state, phase: "polling", participants };
  if (result.status === "FAILED") {
    return {
      ...state,
      phase: "failed",
      participants,
      slots: undefined,
      error: failureText(participants),
      isRefreshing: false,
    };
  }
  return {
    ...state,
    phase: "done",
    participants,
    slots: result.slots,
    defaultDurationMinutes: result.defaultDurationMinutes,
    durationMinutes: result.durationMinutes,
    error: undefined,
    isRefreshing: false,
  };
}

// Every start and refresh begins a new run so responses and timers from superseded requests
// (an older search, an earlier duration pick, an unmounted view) are ignored.
function useRunControl() {
  const runId = useRef(0);
  const poll = useRef<Timer | null>(null);
  const deadline = useRef<Timer | null>(null);
  const clear = useCallback(() => {
    if (poll.current) clearTimeout(poll.current);
    if (deadline.current) clearTimeout(deadline.current);
    poll.current = null;
    deadline.current = null;
  }, []);
  const next = useCallback(() => {
    clear();
    return ++runId.current;
  }, [clear]);
  const isCurrent = useCallback((id: number) => id === runId.current, []);
  const schedule = useCallback((fn: () => void) => {
    poll.current = setTimeout(fn, POLL_INTERVAL_MS);
  }, []);
  const armDeadline = useCallback(
    (onTimeout: () => void) => {
      if (deadline.current) clearTimeout(deadline.current);
      deadline.current = setTimeout(() => {
        next();
        onTimeout();
      }, POLL_TIMEOUT_MS);
    },
    [next]
  );
  useEffect(() => () => void next(), [next]);
  return useMemo(
    () => ({ next, isCurrent, clear, schedule, armDeadline }),
    [next, isCurrent, clear, schedule, armDeadline]
  );
}

export class VennBookNotReadyError extends Error {
  constructor() {
    super("There is no finished search to book from");
    this.name = "VennBookNotReadyError";
  }
}

export type VennStartInput = RouterInputs["viewer"]["venn"]["startSearch"];
export type VennParticipant = VennStatus["participants"][number];
export type VennSlotsResult = NonNullable<VennStatus["slots"]>;
export type VennSearchPhase = "idle" | "polling" | "done" | "failed" | "timeout";
export type VennNotice = "venn_search_stale" | "venn_slot_taken";
export type VennSearchState = {
  phase: VennSearchPhase;
  participants: VennParticipant[];
  slots?: VennSlotsResult;
  defaultDurationMinutes?: number;
  durationMinutes?: number;
  error?: string;
  notice?: VennNotice;
  isRefreshing?: boolean;
};

export function useVennSearch() {
  const utils = trpc.useUtils();
  const startMutation = trpc.viewer.venn.startSearch.useMutation();
  const bookMutation = trpc.viewer.venn.book.useMutation();
  const [state, setState] = useState<VennSearchState>(IDLE);
  const run = useRunControl();
  const searchIdRef = useRef<string | null>(null);
  const durationRef = useRef<number | undefined>(undefined);
  const lastInputRef = useRef<VennStartInput | null>(null);

  const armDeadline = useCallback(
    () => run.armDeadline(() => setState((s) => ({ ...s, phase: "timeout", isRefreshing: false }))),
    [run]
  );

  const poll = useCallback(
    async (runId: number, searchId: string, consecutiveErrors = 0) => {
      let result: VennStatus;
      try {
        // staleTime 0 so each poll hits the server instead of returning the cached PENDING result.
        result = await utils.viewer.venn.searchStatus.fetch(
          { searchId, durationMinutes: durationRef.current },
          { staleTime: 0 }
        );
      } catch (error) {
        if (!run.isCurrent(runId)) return;
        if (consecutiveErrors < MAX_CONSECUTIVE_POLL_ERRORS) {
          run.schedule(() => void poll(runId, searchId, consecutiveErrors + 1));
          return;
        }
        run.clear();
        setState((s) => ({ ...s, phase: "failed", error: errorMessage(error), isRefreshing: false }));
        return;
      }
      if (!run.isCurrent(runId)) return;
      setState((s) => applyStatus(s, result));
      if (result.status === "PENDING") {
        run.schedule(() => void poll(runId, searchId));
        return;
      }
      run.clear();
      if (result.status === "DONE") durationRef.current = result.durationMinutes;
    },
    [utils, run]
  );

  const start = useCallback(
    async (input: VennStartInput, notice?: VennNotice) => {
      const runId = run.next();
      lastInputRef.current = input;
      searchIdRef.current = null;
      durationRef.current = undefined;
      setState({ phase: "polling", participants: [], notice });
      let searchId: string;
      try {
        ({ searchId } = await startMutation.mutateAsync(input));
      } catch (error) {
        if (!run.isCurrent(runId)) return;
        setState({ phase: "failed", participants: [], error: errorMessage(error), notice });
        return;
      }
      if (!run.isCurrent(runId)) return;
      searchIdRef.current = searchId;
      armDeadline();
      await poll(runId, searchId);
    },
    [armDeadline, poll, startMutation, run]
  );

  const refresh = useCallback(
    async (notice?: VennNotice) => {
      const searchId = searchIdRef.current;
      if (!searchId) return;
      const runId = run.next();
      setState((s) => ({ ...s, isRefreshing: true, notice }));
      armDeadline();
      await poll(runId, searchId);
    },
    [armDeadline, poll, run]
  );

  const setDuration = useCallback(
    (minutes: number) => {
      durationRef.current = minutes;
      setState((s) => ({ ...s, durationMinutes: minutes }));
      void refresh();
    },
    [refresh]
  );

  const book = useCallback(
    async ({ start: slotStart, title }: { start: Date; title: string }): Promise<{ uid: string } | null> => {
      const searchId = searchIdRef.current;
      const input = lastInputRef.current;
      const durationMinutes = durationRef.current;
      if (!searchId || !input || !durationMinutes) throw new VennBookNotReadyError();
      try {
        const { uid } = await bookMutation.mutateAsync({
          searchId,
          start: slotStart.toISOString(),
          durationMinutes,
          title,
          timeZone: input.timeZone,
        });
        return { uid };
      } catch (error) {
        const code = conflictCode(error);
        if (!code) throw error;
        if (code === "venn_search_stale") void start(input, code);
        else await refresh(code);
        return null;
      }
    },
    [bookMutation, refresh, start]
  );

  return {
    state,
    start: (input: VennStartInput) => void start(input),
    retry: () => {
      if (lastInputRef.current) void start(lastInputRef.current);
    },
    setDuration,
    book,
    clearNotice: () => setState((s) => (s.notice ? { ...s, notice: undefined } : s)),
    isBooking: bookMutation.isPending,
  };
}
