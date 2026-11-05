import { createHash, randomBytes } from 'node:crypto';

import express from 'express';

/**
 * Counts a Junk Oracle combo at most once per visitor per day, without a cookie
 * and without storing anything about the visitor (see docs/analytics.md).
 *
 * The same trick cookieless analytics (Umami included) use for "unique
 * visitors": hash the IP and user agent together with a secret salt that is
 * drawn at random each UTC day and never written anywhere. Within the day the
 * hash is stable, so a repeat is recognised; once the salt rotates, nothing
 * that remains can be tied to an address again — and nothing remains anyway,
 * because the set of hashes is dropped with the salt. The combo signature is
 * folded into the hash so a visitor can still contribute one count to *each*
 * distinct combo they search.
 *
 * This catches what the client's `countAsSearch` flag can't: the same search
 * repeated from another tab or after a reload, and a script hitting the API
 * directly. Memory is bounded by one day of distinct (visitor, combo) pairs.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

let saltDay = -1;
let salt = '';
let seenToday = new Set<string>();

function rotateSaltIfNewDay(): void {
  const day = Math.floor(Date.now() / DAY_MS);
  if (day === saltDay) {
    return;
  }
  saltDay = day;
  salt = randomBytes(32).toString('hex');
  seenToday = new Set();
}

/**
 * `true` the first time this visitor sends this combo today, `false` on every
 * repeat until the day rolls over. Never throws — a request with no IP or user
 * agent still hashes (to a shared bucket, which merely means two such
 * requesters can shadow each other).
 */
export function isFirstSearchToday(
  req: express.Request,
  signature: string,
): boolean {
  rotateSaltIfNewDay();
  const digest = createHash('sha256')
    .update([
      salt,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
      signature,
    ].join('\n'))
    .digest('hex');
  if (seenToday.has(digest)) {
    return false;
  }
  seenToday.add(digest);
  return true;
}

/** Test-only: forget today's visitors, as the day rollover would. */
export function resetSearchDedupForTests(): void {
  saltDay = -1;
}
