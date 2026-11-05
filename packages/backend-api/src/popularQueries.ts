import express from 'express';

import { getPrisma } from '@app/prisma';
import { isFirstSearchToday } from '@app/searchDedup';
import { Prisma } from '@local-prisma/generated/client';
import { GuaranteeFilters } from '@shared/api/endpoints/junkToGuarantee.models';
import { EquipmentRankKind } from '@shared/domain/rank';

/**
 * Records the accepted-outcome filters of a Junk Oracle query for the "most
 * searched" feature (see `PopularJunkOracleQuery`/`Term`/`Day` in schema.prisma
 * and docs/analytics.md). Distinct from `trackGuaranteeQuery` in `analytics.ts`,
 * which sends only counts to Umami for human dashboards — this stores *which*
 * items were picked, in our own DB, so the app can read popularity back at
 * runtime (e.g. to preload suggestions).
 */

/**
 * How far back `GET /popular`'s "recent" ranking looks. At Wizda's traffic
 * (~30 searches a day as of 2026-11) a month holds several hundred searches —
 * enough to rank a top five without the list reshuffling day to day.
 */
export const POPULAR_WINDOW_DAYS = 30;

/**
 * How long per-day counts are kept before `recordPopularQuery` prunes them.
 * Longer than the window on purpose, so the window can be widened later
 * without a gap; the all-time `count` is never pruned.
 */
const POPULAR_RETENTION_DAYS = 90;

/** Midnight UTC, `daysAgo` days before today — a `@db.Date` boundary. */
export function utcDayStart(daysAgo: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
}

/**
 * The resolved, already-validated filter axes to record. Plain `string[]`
 * (not the wire-typed `GuaranteeFilters`, whose `rank` is enum-typed) —
 * mirrors the internal convention in `matchedOutcome.ts`: these are stable
 * public keys (names/codes/kinds/stringified levels) by the time a route
 * calls this, so nothing here needs the enum.
 */
export interface PopularQueryFilters {
  equipment?: string[] | undefined,
  quality?: number[] | undefined,
  grade?: number[] | undefined,
  blessings?: string[] | undefined,
  rank?: string[] | undefined,
  category?: string[] | undefined,
}

/** One canonicalized query: its dedup key plus the flat list of axis-value terms. */
interface CanonicalQuery {
  signature: string,
  terms: { kind: string, key: string }[],
}

/**
 * Canonicalizes a query's non-empty filter axes into a stable signature (so
 * logically-identical searches collapse into one counted combo) plus the flat
 * per-axis terms to link to it. Axis order is fixed (alphabetical by kind) and
 * each axis's values are de-duped and sorted, so the same set of filters always
 * produces the same signature regardless of the order the client sent them in.
 * Returns `null` when every axis is empty (the all-wildcard query, already
 * rejected by the route's `hasAnyFilter` check before this is ever called).
 */
function canonicalizeFilters(filters: PopularQueryFilters): CanonicalQuery | null {
  const axes: [string, string[]][] = [
    ['blessing', filters.blessings ?? []],
    ['category', filters.category ?? []],
    ['equipment', filters.equipment ?? []],
    ['grade', (filters.grade ?? []).map(String)],
    ['quality', (filters.quality ?? []).map(String)],
    ['rank', filters.rank ?? []],
  ];

  const nonEmptyAxes = axes
    .map(([kind, values]) => [kind, [...new Set(values)].sort()] as [string, string[]])
    .filter(([, values]) => values.length > 0);

  if (nonEmptyAxes.length === 0) {
    return null;
  }

  return {
    signature: JSON.stringify(nonEmptyAxes),
    terms: nonEmptyAxes.flatMap(([kind, values]) => values.map((key) => ({ kind, key }))),
  };
}

/**
 * Fire-and-forget: counts one search of this combo, both all-time and for today.
 * Never awaited by the caller and never fails the response — mirrors
 * `trackGuaranteeQuery`'s fire-and-forget shape in `analytics.ts`.
 *
 * Skipped when the same visitor already sent this combo today (see
 * `searchDedup.ts`) — the second line of defence behind the client's
 * `countAsSearch` flag, which the route checks before calling this.
 */
export function recordPopularQuery(
  req: express.Request,
  filters: PopularQueryFilters,
): void {
  const canonical = canonicalizeFilters(filters);
  if (!canonical) {
    return;
  }
  if (!isFirstSearchToday(req, canonical.signature)) {
    return;
  }

  recordCanonicalQuery(canonical)
    .catch((error) => console.error('[popularQueries] record failed:', error));
}

/**
 * Upserts the combo (incrementing its all-time `count`, or creating it with its
 * `terms`), then today's bucket for it, then drops buckets past retention. Three
 * statements rather than one nested write because the day upsert needs the
 * combo's id, which only the first statement knows.
 *
 * The prune runs on every recorded search. That's a few dozen tiny deletes a
 * day, and it keeps the table self-tending with no cron to forget.
 */
async function recordCanonicalQuery(canonical: CanonicalQuery): Promise<void> {
  const prisma = getPrisma();
  const today = utcDayStart(0);

  const upsertQuery = () => prisma.popularJunkOracleQuery.upsert({
    where: { signature: canonical.signature },
    create: {
      signature: canonical.signature,
      terms: { create: canonical.terms },
    },
    update: {
      count: { increment: 1 },
    },
    select: { id: true },
  });
  // The nested `terms` create keeps Prisma off its atomic ON CONFLICT path, so
  // two visitors sending the same brand-new combo in the same instant can both
  // try to create it — the loser hits the unique signature. On that one error,
  // go again: the row exists now, so the retry takes the increment branch.
  const query = await upsertQuery().catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return upsertQuery();
    }
    throw error;
  });

  await prisma.popularJunkOracleQueryDay.upsert({
    where: { queryId_day: { queryId: query.id, day: today } },
    create: { queryId: query.id, day: today },
    update: { count: { increment: 1 } },
  });

  await prisma.popularJunkOracleQueryDay.deleteMany({
    where: { day: { lt: utcDayStart(POPULAR_RETENTION_DAYS) } },
  });
}

/**
 * The inverse of {@link canonicalizeFilters}: turns a stored `signature` back
 * into wire-typed `GuaranteeFilters`, for `GET /popular` to report a popular
 * combo the same way a client would have sent it. `rank`'s cast to
 * `EquipmentRankKind[]` is safe — the values only ever got into the signature
 * via an already-validated `rank` filter (see `resolveCandidateEquipmentIds`),
 * mirroring the same cast in `matchedOutcome.ts`.
 */
export function filtersFromSignature(signature: string): GuaranteeFilters {
  const axes = new Map(JSON.parse(signature) as [string, string[]][]);
  const filters: GuaranteeFilters = {};

  const blessings = axes.get('blessing');
  if (blessings) {
    filters.blessings = blessings;
  }
  const category = axes.get('category');
  if (category) {
    filters.category = category;
  }
  const equipment = axes.get('equipment');
  if (equipment) {
    filters.equipment = equipment;
  }
  const grade = axes.get('grade');
  if (grade) {
    filters.grade = grade.map(Number);
  }
  const quality = axes.get('quality');
  if (quality) {
    filters.quality = quality.map(Number);
  }
  const rank = axes.get('rank');
  if (rank) {
    filters.rank = rank as EquipmentRankKind[];
  }

  return filters;
}
