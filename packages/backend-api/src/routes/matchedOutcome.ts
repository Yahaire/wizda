/**
 * Resolving a guarantee query against a single junk — "of everything you asked
 * for, what can this junk actually give you?". Feeds `CertaintyCurveResult.matched`
 * so the client can caption a junk's numbers with the real criteria instead of
 * replaying the raw filters.
 *
 * Kept free of Prisma/Express so it stays trivially unit-testable (see
 * `matchedOutcome.test.ts`); the route maps its rows onto {@link MatchedCandidate}.
 */

import { MatchedOutcome } from '@shared/api/endpoints/junkToGuarantee.models';
import { DropRateRow, matchProbabilityForJunk, MatchQuery } from '@shared/domain/dropRateMath';
import { EquipmentTierKind } from '@shared/domain/tier';

/** One equipment's drop rows for a single junk, with the identity used to describe it. */
export interface MatchedCandidate {
  name: string,
  tier: string | null,
  categoryCode: string | null,
  rows: DropRateRow[],
}

/** The queried axes {@link buildMatchedOutcome} can narrow. Wildcards are absent. */
export interface MatchedOutcomeFilters {
  equipment?: string[] | undefined,
  tier?: string[] | undefined,
  category?: string[] | undefined,
}

const ascending = (levels: readonly number[]): number[] => (
  [...levels].sort((left, right) => left - right)
);

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/**
 * Which of the asked-for outcomes this junk can actually produce (see
 * {@link MatchedOutcome}). Every question reduces to one call of
 * {@link matchProbabilityForJunk}, which sums over mutually-exclusive rows and so
 * subsets freely — no inclusion–exclusion correction needed:
 *
 * - an equipment contributes iff its own rows carry nonzero probability;
 * - a quality/grade level survives iff the query restricted to that level does.
 *
 * The grade pass is blessing-aware for free: the grade factor scales each grade by
 * `row.gradePresence`, so a grade with too few slots to hold the required blessings
 * — or an equipment that cannot roll them at all — falls out at zero on its own.
 *
 * An axis is reported only when the query constrained it. Contributing values come
 * back in the order the query listed them, so the result reads the way it was picked.
 */
export function buildMatchedOutcome(
  candidates: readonly MatchedCandidate[],
  matchQuery: MatchQuery,
  filters: MatchedOutcomeFilters,
): MatchedOutcome {
  const contributing = candidates.filter(
    (candidate) => matchProbabilityForJunk(candidate.rows, matchQuery) > 0,
  );
  if (contributing.length === 0) {
    return {};
  }

  const rows = contributing.flatMap((candidate) => candidate.rows);
  const names = new Set(contributing.map((candidate) => candidate.name));
  const tiers = new Set(contributing.map((candidate) => candidate.tier));
  const codes = new Set(contributing.map((candidate) => candidate.categoryCode));

  const matched: MatchedOutcome = {};
  if (filters.equipment?.length) {
    matched.equipment = unique(filters.equipment).filter((name) => names.has(name));
  }
  if (filters.tier?.length) {
    matched.tier = unique(filters.tier).filter((kind) => tiers.has(kind)) as EquipmentTierKind[];
  }
  if (filters.category?.length) {
    matched.category = unique(filters.category).filter((code) => codes.has(code));
  }
  if (matchQuery.quality?.length) {
    matched.quality = ascending(matchQuery.quality).filter(
      (level) => matchProbabilityForJunk(rows, { ...matchQuery, quality: [level] }) > 0,
    );
  }
  if (matchQuery.grade?.length) {
    matched.grade = ascending(matchQuery.grade).filter(
      (level) => matchProbabilityForJunk(rows, { ...matchQuery, grade: [level] }) > 0,
    );
  }
  return matched;
}
