"use client";

import { ALLOWED_DURATIONS, DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS } from "@calcom/features/venn/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { Label, TextField } from "@calcom/ui/components/form";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { VennContactPicker } from "../components/VennContactPicker";
import { VennParticipantStatus } from "../components/VennParticipantStatus";
import { VennSlotPicker } from "../components/VennSlotPicker";
import { useVennContacts } from "../hooks/useVennContacts";
import type { VennSearchState, VennSlotsResult } from "../hooks/useVennSearch";
import { useVennSearch } from "../hooks/useVennSearch";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_OPTIONS = [7, DEFAULT_WINDOW_DAYS, 21, MAX_WINDOW_DAYS];
const SELECT_CLASSES =
  "rounded-md border border-default bg-default px-3 py-2 text-default text-sm focus:outline-none";

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

type NumberSelectProps = {
  id: string;
  label: string;
  value: number;
  options: readonly number[];
  format: (value: number) => string;
  onChange: (value: number) => void;
};

function NumberSelect({ id, label, value, options, format, onChange }: NumberSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        data-testid={id}
        className={SELECT_CLASSES}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

type BookingFormProps = {
  slots: VennSlotsResult["slots"];
  timeZone: string;
  durationControl: ReactNode;
  disabled: boolean;
  isBooking: boolean;
  onBook: (input: { start: Date; title: string }) => Promise<{ uid: string } | null>;
};

function BookingForm({ slots, timeZone, durationControl, disabled, isBooking, onBook }: BookingFormProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState(() => t("venn_default_title"));
  const [error, setError] = useState<string | null>(null);
  // Tie the selection to the slots it was picked from so a new result set clears it.
  const [selection, setSelection] = useState<{ source: typeof slots; time: string } | null>(null);
  const selectedTime = selection?.source === slots ? selection.time : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTime) return;
    setError(null);
    try {
      const booking = await onBook({ start: new Date(selectedTime), title });
      if (booking) router.push(`/booking/${booking.uid}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("something_went_wrong"));
    }
  };

  return (
    <form className="stack-y-4" onSubmit={handleSubmit}>
      {durationControl}
      <VennSlotPicker
        slots={slots}
        timeZone={timeZone}
        selectedTime={selectedTime}
        onSelect={(time) => setSelection({ source: slots, time })}
      />
      <TextField
        label={t("venn_meeting_title")}
        data-testid="venn-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" data-testid="venn-book" disabled={!selectedTime || disabled} loading={isBooking}>
        {t("venn_book")}
      </Button>
    </form>
  );
}

function durationOptions(current?: number): readonly number[] {
  if (!current || (ALLOWED_DURATIONS as readonly number[]).includes(current)) return ALLOWED_DURATIONS;
  return [current, ...ALLOWED_DURATIONS];
}

function hasAnySlot(state: VennSearchState): boolean {
  return Object.values(state.slots?.slots ?? {}).some((day) => day.length > 0);
}

export default function VennView() {
  const { t } = useLocale();
  const { contacts, add } = useVennContacts();
  const { state, start, retry, setDuration, book, isBooking } = useVennSearch();
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [timeZone] = useState(browserTimeZone);

  const toggle = (contactId: number, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(contactId);
      else next.delete(contactId);
      return next;
    });
  };

  const search = (days: number) => {
    const windowStart = new Date();
    start({
      contactIds: Array.from(selectedIds),
      windowStart,
      windowEnd: new Date(windowStart.getTime() + days * MS_PER_DAY),
      timeZone,
    });
  };

  const changeWindow = (days: number) => {
    setWindowDays(days);
    if (state.phase !== "idle") search(days);
  };

  const durationControl = state.durationMinutes ? (
    <NumberSelect
      id="venn-duration"
      label={t("venn_duration")}
      value={state.durationMinutes}
      options={durationOptions(state.durationMinutes)}
      format={(count) => t("venn_duration_minutes", { count })}
      onChange={setDuration}
    />
  ) : null;

  const renderWindowControl = (id: string) => (
    <NumberSelect
      id={id}
      label={t("venn_window")}
      value={windowDays}
      options={WINDOW_OPTIONS}
      format={(count) => t("venn_window_days", { count })}
      onChange={changeWindow}
    />
  );

  const isDone = state.phase === "done";
  const hasSlots = hasAnySlot(state);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <section className="stack-y-4 rounded-xl border border-subtle p-4 lg:w-1/3">
        <VennContactPicker contacts={contacts} selectedIds={selectedIds} onToggle={toggle} onAdd={add} />
        {renderWindowControl("venn-window")}
        <Button
          data-testid="venn-find-times"
          disabled={selectedIds.size === 0}
          loading={state.phase === "polling"}
          onClick={() => search(windowDays)}>
          {t("venn_find_times")}
        </Button>
      </section>

      <section className="stack-y-4 lg:w-2/3" data-testid="venn-results" data-phase={state.phase}>
        {state.notice ? (
          <p role="status" className="text-attention text-sm" data-testid="venn-notice">
            {t(state.notice)}
          </p>
        ) : null}
        {state.phase === "polling" ? <p className="text-sm text-subtle">{t("venn_fetching")}</p> : null}
        {state.phase === "timeout" ? (
          <div className="stack-y-2" data-testid="venn-timeout">
            <p className="text-error text-sm">{t("venn_timeout")}</p>
            <Button color="secondary" data-testid="venn-retry" onClick={retry}>
              {t("venn_retry")}
            </Button>
          </div>
        ) : null}
        {state.phase === "failed" ? (
          <p role="alert" className="text-error text-sm" data-testid="venn-search-failed">
            {state.participants.some((p) => p.status === "FAILED")
              ? t("venn_search_failed")
              : (state.error ?? t("something_went_wrong"))}
          </p>
        ) : null}

        <VennParticipantStatus participants={state.participants} />

        {isDone && !hasSlots ? (
          <div className="stack-y-3" data-testid="venn-no-common-time">
            <p className="text-emphasis text-sm">{t("venn_no_common_time")}</p>
            <div className="flex flex-wrap gap-4">
              {durationControl}
              {renderWindowControl("venn-window-no-common-time")}
            </div>
          </div>
        ) : null}
        {isDone && hasSlots && state.slots ? (
          <BookingForm
            slots={state.slots.slots}
            timeZone={timeZone}
            durationControl={durationControl}
            disabled={!!state.isRefreshing}
            isBooking={isBooking}
            onBook={book}
          />
        ) : null}
      </section>
    </div>
  );
}
