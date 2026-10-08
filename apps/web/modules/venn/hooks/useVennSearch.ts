import type { RouterInputs, RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 90_000;

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

function useTimers() {
  const poll = useRef<Timer | null>(null);
  const deadline = useRef<Timer | null>(null);
  const clear = useCallback(() => {
    if (poll.current) clearTimeout(poll.current);
    if (deadline.current) clearTimeout(deadline.current);
    poll.current = null;
    deadline.current = null;
  }, []);
  useEffect(() => clear, [clear]);
  return useMemo(() => ({ poll, deadline, clear }), [clear]);
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
  const timers = useTimers();
  // Each start bumps the run id so responses and timers from an abandoned run are ignored.
  const runIdRef = useRef(0);
  const searchIdRef = useRef<string | null>(null);
  const durationRef = useRef<number | undefined>(undefined);
  const lastInputRef = useRef<VennStartInput | null>(null);

  const poll = useCallback(
    async (runId: number, searchId: string) => {
      let result: VennStatus;
      try {
        // staleTime 0 so each poll hits the server instead of returning the cached PENDING result.
        result = await utils.viewer.venn.searchStatus.fetch(
          { searchId, durationMinutes: durationRef.current },
          { staleTime: 0 }
        );
      } catch (error) {
        if (runId !== runIdRef.current) return;
        timers.clear();
        setState((s) => ({ ...s, phase: "failed", error: errorMessage(error), isRefreshing: false }));
        return;
      }
      if (runId !== runIdRef.current) return;
      setState((s) => applyStatus(s, result));
      if (result.status === "PENDING") {
        timers.poll.current = setTimeout(() => void poll(runId, searchId), POLL_INTERVAL_MS);
        return;
      }
      timers.clear();
      if (result.status === "DONE") durationRef.current = result.durationMinutes;
    },
    [utils, timers]
  );

  const start = useCallback(
    async (input: VennStartInput, notice?: VennNotice) => {
      timers.clear();
      const runId = ++runIdRef.current;
      lastInputRef.current = input;
      searchIdRef.current = null;
      durationRef.current = undefined;
      setState({ phase: "polling", participants: [], notice });
      let searchId: string;
      try {
        ({ searchId } = await startMutation.mutateAsync(input));
      } catch (error) {
        if (runId !== runIdRef.current) return;
        setState({ phase: "failed", participants: [], error: errorMessage(error), notice });
        return;
      }
      if (runId !== runIdRef.current) return;
      searchIdRef.current = searchId;
      timers.deadline.current = setTimeout(() => {
        runIdRef.current++;
        timers.clear();
        setState((s) => ({ ...s, phase: "timeout" }));
      }, POLL_TIMEOUT_MS);
      await poll(runId, searchId);
    },
    [poll, startMutation, timers]
  );

  const refresh = useCallback(
    async (notice?: VennNotice) => {
      const searchId = searchIdRef.current;
      if (!searchId) return;
      setState((s) => ({ ...s, isRefreshing: true, notice }));
      await poll(runIdRef.current, searchId);
    },
    [poll]
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
      if (!searchId || !input || !durationMinutes) return null;
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
    isBooking: bookMutation.isPending,
  };
}
