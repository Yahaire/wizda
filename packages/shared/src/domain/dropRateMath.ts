/**
 * Drop-rate math — the pure, Prisma-free core of the "how much junk to
 * guarantee item X?" calculation.
 *
 * Derivation, rationale, and the blessing extension are documented in
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
  /**
   * Optional per-grade probability that the query's required blessings are all
   * present, for k = 1..5 at indices 0..4 — as produced by
   * {@link blessingPresenceByGrade}. It rides on the row because it's a property
   * of the row's *equipment* (blessing odds are junk-independent). Absent means
   * "no blessing filter" and is treated as all-ones (no effect on the grade
   * factor). See `docs/calculation.md`.
   */
  gradePresence?: readonly number[],
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
 * The grade factor for one row: the accepted-grade probability mass, but with
 * each grade's contribution scaled by `row.gradePresence` — the chance the
 * query's required blessings are all present at that grade (from
 * {@link blessingPresenceByGrade}). With no blessing filter (`gradePresence`
 * absent) every scale is 1, so this reduces exactly to
 * `selectedRateMass(gradeRates, acceptedGrades)`. See `docs/calculation.md`.
 */
function gradeFactorForRow(
  row: DropRateRow,
  acceptedGrades: readonly number[] | undefined,
): number {
  const acceptedSet = (acceptedGrades && acceptedGrades.length > 0)
    ? new Set(acceptedGrades)
    : null; // null = wildcard (any grade)

  let sum = 0;
  for (let i = 0; i < RATE_LEVEL_COUNT; i++) {
    if (acceptedSet && !acceptedSet.has(i + 1)) {
      continue;
    }
    sum += (row.gradeRates[i] ?? 0) * (row.gradePresence?.[i] ?? 1);
  }
  return sum;
}

/**
 * P(all `required` blessings present | grade), for each grade 1..5 at indices
 * 0..4 — the blessing extension of the grade factor (`docs/calculation.md`).
 *
 * A grade-`g` piece has `m = g − 1` active slots, rolled in order top-to-bottom
 * (slot 1 first), so it uses `slotRates[0..m-1]`. `slotRates[s]` maps each
 * blessing code to its published rate for slot `s+1`; only nonzero entries need
 * be present. Because additional blessings don't stack, a slot never rolls a
 * blessing an earlier slot already took: it draws from its own published row
 * with those removed and the survivors renormalised. The joint is therefore an
 * ordered chain, and the presence sums it over the assignments covering
 * `required`:
 *
 *   P(b₁ … b_m) = Π_s  rate_s(b_s) / Σ_{x ∉ {b₁ … b_{s−1}}} rate_s(x)
 *
 *   presence    = Σ over assignments whose blessing set ⊇ required  of  P(b₁ … b_m)
 *
 * The chain already sums to 1 over the valid assignments, so — unlike a model
 * that rerolls the *whole* piece on a collision — there is no global normaliser
 * to divide out. See `docs/calculation.md` for why we model it this way, and for
 * the one assumption it rests on.
 *
 * Edge cases: `required` empty ⇒ 1 at every grade (so the grade factor collapses
 * to the plain accepted mass); `|required| > m` ⇒ 0 (can't fit); a required
 * blessing no slot can roll ⇒ 0 (no assignment covers it).
 */
export function blessingPresenceByGrade(
  slotRates: readonly ReadonlyMap<string, number>[],
  required: readonly string[],
): number[] {
  const requiredSet = new Set(required);
  const presence = new Array<number>(RATE_LEVEL_COUNT).fill(0);
  for (let grade = 1; grade <= RATE_LEVEL_COUNT; grade++) {
    const activeSlots = grade - 1;
    presence[grade - 1] = jointBlessingPresence(
      slotRates.slice(0, activeSlots),
      requiredSet,
    );
  }
  return presence;
}

/**
 * Core of {@link blessingPresenceByGrade} for a fixed active-slot count: the
 * sequential without-replacement chain over the given slots, summed over the
 * assignments covering `required`. See that function's doc.
 */
function jointBlessingPresence(
  slots: readonly ReadonlyMap<string, number>[],
  required: ReadonlySet<string>,
): number {
  if (required.size === 0) {
    return 1; // vacuously present at every grade
  }
  if (required.size > slots.length) {
    return 0; // not enough active slots to hold this many distinct blessings
  }

  let total = 0;
  const taken = new Set<string>();

  const walk = (slotIndex: number, chained: number, stillNeeded: number): void => {
    if (stillNeeded > slots.length - slotIndex) {
      return; // too few slots left to fit what's still required
    }
    if (slotIndex === slots.length) {
      total += chained; // stillNeeded is 0 here, or the guard above returned
      return;
    }
    const slotRates = slots[slotIndex];
    if (!slotRates) {
      return; // an empty slot admits no assignment → this path contributes 0
    }

    // What this slot can still roll: its published row minus the blessings
    // earlier slots took. Sum the survivors rather than subtracting the taken
    // ones from 1 — the published rows only sum to 100% up to their rounding.
    let available = 0;
    for (const [blessing, rate] of slotRates) {
      if (rate > 0 && !taken.has(blessing)) {
        available += rate;
      }
    }
    if (available <= 0) {
      return; // nothing left for this slot to roll
    }

    for (const [blessing, rate] of slotRates) {
      if (rate <= 0 || taken.has(blessing)) {
        continue;
      }
      taken.add(blessing);
      walk(
        slotIndex + 1,
        (chained * rate) / available,
        stillNeeded - (required.has(blessing) ? 1 : 0),
      );
      taken.delete(blessing);
    }
  };
  walk(0, 1, required.size);

  return total;
}

/**
 * P(match | junk): the probability that a single junk yields an outcome the
 * query accepts. Sums the per-row product
 * `P(group) · P(equip | group) · P(quality ∈ Q) · gradeFactor` over the
 * (already equipment-filtered) rows, where `gradeFactor` is the accepted-grade
 * mass optionally coupled to required blessings via `row.gradePresence` (see
 * {@link gradeFactorForRow}). Rows are mutually exclusive, so the sum needs no
 * inclusion–exclusion correction — see `docs/calculation.md`.
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
      * gradeFactorForRow(row, query.grade)
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
