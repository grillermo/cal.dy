import dayjs from "@calcom/dayjs";
import { render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VennSlotPicker } from "./VennSlotPicker";

let datePickerRenders = 0;
const MAX_RENDERS = 100;

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("@calcom/features/bookings/Booker/BookerStoreProvider", () => ({
  BookerStoreProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// The real DatePicker calls onChange from an effect without a dependency array, i.e. after every
// render. The throw turns a runaway render loop into a failure instead of a hung test.
vi.mock("@calcom/features/calendars/components/DatePicker", () => ({
  DatePicker: ({
    includedDates,
    selected,
    onChange,
  }: {
    includedDates: string[];
    selected: ReturnType<typeof dayjs> | null;
    onChange: (date: ReturnType<typeof dayjs> | null, omitUpdatingParams?: boolean) => void;
  }) => {
    datePickerRenders += 1;
    if (datePickerRenders > MAX_RENDERS) throw new Error("DatePicker is stuck in a render loop");
    // biome-ignore lint/correctness/useExhaustiveDependencies: mirrors the real DatePicker's effect
    useEffect(() => {
      if (includedDates[0]) onChange(dayjs(selected ?? includedDates[0]), true);
    });
    return null;
  },
}));

const slots = {
  "2026-10-12": [{ time: "2026-10-12T15:00:00.000Z" }],
  "2026-10-13": [{ time: "2026-10-13T15:00:00.000Z" }],
};

describe("VennSlotPicker", () => {
  beforeEach(() => {
    datePickerRenders = 0;
  });

  it("settles after the DatePicker reports the date it is already showing", () => {
    render(<VennSlotPicker slots={slots} timeZone="UTC" selectedTime={null} onSelect={vi.fn()} />);

    expect(datePickerRenders).toBeLessThan(10);
    expect(screen.getAllByTestId("venn-slot")).toHaveLength(1);
  });
});
