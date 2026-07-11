import { describe, expect, it } from 'vitest';

import { formatRelativeAge, isFreshWithinDay } from './relativeTime';

describe('formatRelativeAge', () => {
  const now = new Date('2026-07-11T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('reads "just now" under a minute', () => {
    expect(formatRelativeAge(ago(0), now)).toBe('just now');
    expect(formatRelativeAge(ago(59 * SECOND), now)).toBe('just now');
  });

  it('pluralizes each unit correctly', () => {
    expect(formatRelativeAge(ago(MINUTE), now)).toBe('1 minute ago');
    expect(formatRelativeAge(ago(5 * MINUTE), now)).toBe('5 minutes ago');
    expect(formatRelativeAge(ago(HOUR), now)).toBe('1 hour ago');
    expect(formatRelativeAge(ago(2 * HOUR), now)).toBe('2 hours ago');
    expect(formatRelativeAge(ago(DAY), now)).toBe('1 day ago');
    expect(formatRelativeAge(ago(3 * DAY), now)).toBe('3 days ago');
    expect(formatRelativeAge(ago(14 * DAY), now)).toBe('2 weeks ago');
  });

  it('accepts ISO strings and clamps future instants to "just now"', () => {
    expect(formatRelativeAge(ago(2 * HOUR).toISOString(), now)).toBe('2 hours ago');
    expect(formatRelativeAge(new Date(now.getTime() + HOUR), now)).toBe('just now');
  });

  it('flags the fresh-ink window at the 24h boundary', () => {
    expect(isFreshWithinDay(ago(23 * HOUR), now)).toBe(true);
    expect(isFreshWithinDay(ago(DAY), now)).toBe(false);
  });
});
