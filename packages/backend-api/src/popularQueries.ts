import { getPrisma } from '@app/prisma';
import { GuaranteeFilters } from '@shared/api/endpoints/junkToGuarantee.models';
import { EquipmentRankKind } from '@shared/domain/rank';

/**
 * Records the accepted-outcome filters of a Junk Oracle query for the "most
 * searched" feature (see `PopularJunkOracleQuery`/`Term` in schema.prisma and
 * docs/analytics.md). Distinct from `trackGuaranteeQuery` in `analytics.ts`,
 * which sends only counts to Umami for human dashboards — this stores *which*
 * items were picked, in our own DB, so the app can read popularity back at
 * runtime (e.g. to preload suggestions).
 */

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
 * Fire-and-forget: upserts the query's combo (incrementing `count` if it's
 * been seen before, creating it with its `terms` if not) and its per-axis term
 * rows. Never awaited by the caller and never fails the response — mirrors
 * `trackGuaranteeQuery`'s fire-and-forget shape in `analytics.ts`.
 */
export function recordPopularQuery(filters: PopularQueryFilters): void {
  const canonical = canonicalizeFilters(filters);
  if (!canonical) {
    return;
  }

  getPrisma().popularJunkOracleQuery.upsert({
    where: { signature: canonical.signature },
    create: {
      signature: canonical.signature,
      terms: { create: canonical.terms },
    },
    update: {
      count: { increment: 1 },
    },
  }).catch((error) => console.error('[popularQueries] record failed:', error));
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
