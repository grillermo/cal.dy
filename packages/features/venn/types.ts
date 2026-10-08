export type Interval = { start: Date; end: Date };
export type VennProviderKind = "CALENDLY" | "CALCOM" | "LOCAL";
export type ParsedBookingUrl = {
  provider: VennProviderKind;
  profile: string;
  eventSlug: string;
  normalizedUrl: string;
};
export type VennSlots = { slots: Record<string, { time: string }[]> };
