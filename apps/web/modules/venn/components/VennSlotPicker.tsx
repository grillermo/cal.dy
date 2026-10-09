"use client";

import type { Dayjs } from "@calcom/dayjs";
import dayjs from "@calcom/dayjs";
import { BookerStoreProvider } from "@calcom/features/bookings/Booker/BookerStoreProvider";
import { DatePicker } from "@calcom/features/calendars/components/DatePicker";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { useMemo, useState } from "react";
import type { VennSlotsResult } from "../hooks/useVennSearch";

type Props = {
  slots: VennSlotsResult["slots"];
  timeZone: string;
  selectedTime: string | null;
  onSelect: (time: string) => void;
};

// The stock Booker cannot be fed the venn schedule without its own event/slot fetches and slot
// reservations for the hidden event type, so the picker reuses only the calendar grid.
export function VennSlotPicker({ slots, timeZone, selectedTime, onSelect }: Props) {
  const { t, i18n } = useLocale();
  const days = useMemo(
    () =>
      Object.keys(slots)
        .filter((day) => slots[day].length > 0)
        .sort(),
    [slots]
  );
  // Picks are tied to the slots they were made against so a new result set (another duration or
  // window) resets both the day and the displayed month to the first available day.
  const [picked, setPicked] = useState<{ source: typeof slots; day: string | null; month: Dayjs | null }>({
    source: slots,
    day: null,
    month: null,
  });
  const current = picked.source === slots ? picked : { source: slots, day: null, month: null };
  // DatePicker reports its selected date from an effect after every render, so a pick that changes
  // nothing must keep the previous state or the picker re-renders forever and starves router.push.
  const updatePicked = (change: { day?: string; month?: Dayjs }) =>
    setPicked((previous) => {
      const base = previous.source === slots ? previous : { source: slots, day: null, month: null };
      const day = change.day ?? base.day;
      const month = change.month ?? base.month;
      if (previous === base && day === base.day && month?.valueOf() === base.month?.valueOf()) return previous;
      return { ...base, day, month };
    });
  const activeDay = current.day && days.includes(current.day) ? current.day : (days[0] ?? null);
  const browsingDate = current.month ?? dayjs(activeDay ?? undefined).startOf("month");

  const formatTime = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit", timeZone }),
    [i18n.language, timeZone]
  );

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <div className="md:w-2/3">
        <BookerStoreProvider>
          <DatePicker
            locale={i18n.language}
            includedDates={days}
            slots={slots}
            selected={activeDay ? dayjs(activeDay) : null}
            browsingDate={browsingDate}
            onMonthChange={(date) => updatePicked({ month: date.startOf("month") })}
            onChange={(date) => {
              if (date) updatePicked({ day: date.format("YYYY-MM-DD") });
            }}
            showNoAvailabilityDialog={false}
          />
        </BookerStoreProvider>
      </div>
      <div className="stack-y-2 md:w-1/3" data-testid="venn-slot-list">
        <p className="font-medium text-emphasis text-sm">{t("venn_pick_time")}</p>
        {activeDay && slots[activeDay]?.length ? (
          slots[activeDay].map((slot) => (
            <Button
              key={slot.time}
              data-testid="venn-slot"
              data-time={slot.time}
              className="w-full justify-center"
              color={slot.time === selectedTime ? "primary" : "secondary"}
              onClick={() => onSelect(slot.time)}>
              {formatTime.format(new Date(slot.time))}
            </Button>
          ))
        ) : (
          <p className="text-sm text-subtle">{t("venn_no_slots_on_day")}</p>
        )}
      </div>
    </div>
  );
}
