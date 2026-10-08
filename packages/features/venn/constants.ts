export const ALLOWED_DURATIONS = [15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 240] as const;
export const DEFAULT_WINDOW_DAYS = 14;
export const MAX_WINDOW_DAYS = 31;
export const MIN_NOTICE_MINUTES = 120;
export const SLOT_STEP_MINUTES = 15;
export const STALE_AFTER_MS = 5 * 60 * 1000;
export const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
export const HIDDEN_EVENT_SLUG = "venn-group-meeting";
export const HIDDEN_EVENT_TITLE = "Group Meeting";
export const DEFAULT_TITLE = "Group Meeting";
export const VENN_TITLE_FIELD = "venn_title";
// A fetch task is created leased this far ahead so the cron skips it while startSearch's kick runs it; it must
// outlast the slowest fetch (a few requests x 3 attempts x 10 s timeout). If the kick is lost, the cron runs it after.
export const VENN_TASK_LEASE_MS = 3 * 60 * 1000;
// VennSearchResult keeps a bare contactId, so a contact deleted mid-search must surface as a failed participant.
export const CONTACT_REMOVED_ERROR = "contact removed";
export const REMOVED_CONTACT_NAME = "Removed contact";
