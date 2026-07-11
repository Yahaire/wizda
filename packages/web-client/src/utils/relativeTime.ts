/**
 * Human, coarse "time ago" phrasing for the data-freshness label and Wizda's
 * freshness toast — e.g. "just now", "2 hours ago", "3 days ago". English only
 * for now (matches the single voice locale); the buckets are deliberately coarse
 * because players only care roughly how stale the data is, never to the second.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

function toDate(from: Date | string): Date {
  return from instanceof Date ? from : new Date(from);
}

/** Milliseconds elapsed since `from`, clamped at 0 so clock skew never goes negative. */
function elapsedMs(from: Date | string, now: Date): number {
  return Math.max(0, now.getTime() - toDate(from).getTime());
}

function pluralize(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * Coarse "time ago" phrase for a past instant. Returns "just now" under a minute,
 * then the largest whole unit (minutes → years). `now` is injectable for tests.
 */
export function formatRelativeAge(from: Date | string, now: Date = new Date()): string {
  const ms = elapsedMs(from, now);

  if (ms < MINUTE_MS) {
    return "just now";
  }
  if (ms < HOUR_MS) {
    return pluralize(Math.floor(ms / MINUTE_MS), "minute");
  }
  if (ms < DAY_MS) {
    return pluralize(Math.floor(ms / HOUR_MS), "hour");
  }
  if (ms < WEEK_MS) {
    return pluralize(Math.floor(ms / DAY_MS), "day");
  }
  if (ms < MONTH_MS) {
    return pluralize(Math.floor(ms / WEEK_MS), "week");
  }
  if (ms < YEAR_MS) {
    return pluralize(Math.floor(ms / MONTH_MS), "month");
  }
  return pluralize(Math.floor(ms / YEAR_MS), "year");
}

/** True when `from` is within the last 24 hours — the "fresh ink" window. */
export function isFreshWithinDay(from: Date | string, now: Date = new Date()): boolean {
  return elapsedMs(from, now) < DAY_MS;
}
