/**
 * Human, coarse "time ago" phrasing for the data-freshness label and Wizda's
 * freshness toast — e.g. "just now", "2 hours ago", "3 days ago" (and their
 * localized equivalents). The wording is delegated to `Intl.RelativeTimeFormat`
 * keyed by the active language, so a new locale needs no new copy here; the
 * buckets are deliberately coarse because players only care roughly how stale
 * the data is, never to the second.
 */

import { getLang, getStrings } from '@/i18n/languageStore';

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

/** The largest whole unit that fits `ms`, as an `Intl.RelativeTimeFormat` pair. */
function largestUnit(ms: number): { value: number, unit: Intl.RelativeTimeFormatUnit } {
  if (ms < HOUR_MS) {
    return { value: Math.floor(ms / MINUTE_MS), unit: 'minute' };
  }
  if (ms < DAY_MS) {
    return { value: Math.floor(ms / HOUR_MS), unit: 'hour' };
  }
  if (ms < WEEK_MS) {
    return { value: Math.floor(ms / DAY_MS), unit: 'day' };
  }
  if (ms < MONTH_MS) {
    return { value: Math.floor(ms / WEEK_MS), unit: 'week' };
  }
  if (ms < YEAR_MS) {
    return { value: Math.floor(ms / MONTH_MS), unit: 'month' };
  }
  return { value: Math.floor(ms / YEAR_MS), unit: 'year' };
}

/**
 * Coarse "time ago" phrase for a past instant, in the active language. Returns
 * the "just now" form under a minute, then the largest whole unit (minutes →
 * years). `now` is injectable for tests.
 */
export function formatRelativeAge(from: Date | string, now: Date = new Date()): string {
  const ms = elapsedMs(from, now);
  if (ms < MINUTE_MS) {
    return getStrings().common.justNow;
  }
  // `numeric: 'always'` keeps the plain "N units ago" form — no locale idioms
  // ("yesterday", "last week") that the coarse buckets here don't intend.
  const formatter = new Intl.RelativeTimeFormat(getLang(), { numeric: 'always' });
  const { value, unit } = largestUnit(ms);
  return formatter.format(-value, unit);
}

/** True when `from` is within the last 24 hours — the "fresh ink" window. */
export function isFreshWithinDay(from: Date | string, now: Date = new Date()): boolean {
  return elapsedMs(from, now) < DAY_MS;
}
