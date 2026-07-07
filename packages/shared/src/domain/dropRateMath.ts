/**
 * Drop-rate math — the pure, Prisma-free core of the "how much junk to
 * guarantee item X?" calculation.
 *
 * Derivation, rationale, and the (deferred) blessing extension are documented in
 * `docs/calculation.md`. Keep this module free of DB/HTTP concerns so it stays
 * trivially unit-testable (see `dropRateMath.test.ts`).
 */

/** Number of quality (★) levels and grade levels; both are 1–5. */
export const RATE_LEVEL_COUNT = 5;

/**
 * One drop-table row's per-equipment distributions, as fractions in [0, 1].
 * A minimal shape the backend maps its Prisma `EquipmentDropRate` rows onto —
 * only the fields the calc needs, equipment already filtered by the caller.
 */
export interface DropRateRow {
  /** P(group): the group's overall drop rate. */
  groupDropRate: number,
  /** P(equipment | group): this equipment's rate within its group. */
  dropRate: number,
  /** P(quality k | equipment) for k = 1..5, at indices 0..4. */
  qualityRates: readonly number[],
  /** P(grade k | equipment) for k = 1..5, at indices 0..4. */
  gradeRates: readonly number[],
}

/**
 * The accepted-outcome sets for a query. Each axis is an OR set; an empty or
 * omitted set is a wildcard ("accept any") on that axis. Equipment filtering is
 * done upstream (the rows passed to {@link matchProbabilityForJunk} are already
 * the matching-equipment rows), so it isn't represented here.
 */
export interface MatchQuery {
  /** Accepted quality numbers (1–5). Empty/omitted = any quality. */
  quality?: readonly number[],
  /** Accepted grade numbers (1–5). Empty/omitted = any grade. */
  grade?: readonly number[],
}

/**
 * P(level ∈ accepted) for one equipment: the summed probability mass of the
 * accepted 1-based levels. An empty/omitted accepted set is a wildcard → 1.
 * Levels outside 1..5 contribute nothing.
 */
function selectedRateMass(
  rates: readonly number[],
  accepted: readonly number[] | undefined,
): number {
  if (!accepted || accepted.length === 0) {
    return 1;
  }

  return (
    [...new Set(accepted)]
      .filter((level) => level >= 1 && level <= RATE_LEVEL_COUNT)
      .reduce((sum, level) => sum + (rates[level - 1] ?? 0), 0)
  );
}

/**
 * P(match | junk): the probability that a single junk yields an outcome the
 * query accepts. Sums the per-row product
 * `P(group) · P(equip | group) · P(quality ∈ Q) · P(grade ∈ G)` over the
 * (already equipment-filtered) rows. Rows are mutually exclusive, so the sum
 * needs no inclusion–exclusion correction — see `docs/calculation.md`.
 */
export function matchProbabilityForJunk(
  rows: readonly DropRateRow[],
  query: MatchQuery,
): number {
  return rows.reduce((total, row) => {
    const rowProbability = (
      + row.groupDropRate
      * row.dropRate
      * selectedRateMass(row.qualityRates, query.quality)
      * selectedRateMass(row.gradeRates, query.grade)
    );
    return total + rowProbability;
  }, 0);
}

/**
 * How many junk must be farmed to reach `confidence` of at least one success,
 * given a per-junk success probability. Solves `1 − (1 − p)^n ≥ confidence`:
 *
 *   n = ceil( ln(1 − confidence) / ln(1 − p) )
 *
 * Returns `null` when the target is impossible (`p ≤ 0`) — no finite amount
 * suffices. Returns 1 when already guaranteed per draw (`p ≥ 1`). Throws on an
 * out-of-range confidence (must be strictly between 0 and 1; true 100% is
 * unreachable).
 */
export function junksNeededForConfidence(
  probabilityPerJunk: number,
  confidence: number,
): number | null {
  if (!(confidence > 0 && confidence < 1)) {
    throw new RangeError(`confidence must be in (0, 1), got ${confidence}`);
  }

  if (probabilityPerJunk <= 0) {
    return null;
  }
  if (probabilityPerJunk >= 1) {
    return 1;
  }

  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - probabilityPerJunk));
}
