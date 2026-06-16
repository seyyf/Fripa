// A session counts as "online" if its last heartbeat is within this window.
export const ONLINE_WINDOW_MS = 45_000;
// Swipe rate is computed over this trailing window.
export const SWIPE_RATE_WINDOW_MS = 60_000;
// Hard cap on tracked sessions (memory safety).
export const PRESENCE_MAX_ENTRIES = 5_000;
// How often the online count is sampled for the hourly rollup.
export const SAMPLE_INTERVAL_MS = 60_000;
// How often the hourly VisitorSnapshot row is written.
export const ROLLUP_INTERVAL_MS = 3_600_000;
