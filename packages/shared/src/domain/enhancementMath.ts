/**
 * Enhancement math — the pure, Prisma-free core of "what value does a
 * blessing end up at after enhancing?".
 *
 * Derivation, rationale, and the milestone model are documented in
 * `docs/milestone-blessings.md`; the stone mechanics {@link composeSlotValue}
 * models are in `docs/stones.md`. Keep this module free of DB/HTTP concerns so
 * it stays trivially unit-testable (see `enhancementMath.test.ts`).
 *
 * Notation: `⊛` is convolution — `A ⊛ B` is the distribution of `a + b` with
 * `a` and `b` drawn independently. That is exactly what {@link convolve} does.
 */

/**
 * A probability distribution over a run of consecutive integer values.
 * `probabilities[i]` is P(minValue + i). Not assumed normalised — see
 * {@link normalizeDistribution}.
 */
export interface ValueDistribution {
  minValue: number,
  probabilities: readonly number[],
}

/**
 * Tolerance for comparing two distributions that are expected to represent the
 * *same* underlying values — either "is this uniform?" or "does a reconvolved
 * distribution reproduce a published one?". The source publishes percentages
 * to 4 decimal places, so a single cell can be off by ~1e-6, and `fas`
 * (`drop ⊛ bonus ⊛ bonus`, a double convolution) compounds that to
 * ~6e-7 per cell — observed against the live page, worst case across 380
 * (group, quality, blessing) rows. `SUM_TOLERANCE` (0.005, `rateParsing.ts`)
 * allows for a distribution's own rounding when summing to ~100% and is far
 * too loose for a per-cell check; `1e-9` is too tight and fails on every real
 * row. `1e-5` is a ~15x margin over the observed residual and still 500x
 * tighter than `SUM_TOLERANCE`.
 */
const RECONVOLUTION_TOLERANCE = 1e-5;

function maxValue(dist: ValueDistribution): number {
  return dist.minValue + dist.probabilities.length - 1;
}

function probabilityAt(dist: ValueDistribution, value: number): number {
  return dist.probabilities[value - dist.minValue] ?? 0;
}

/** Rescales `probabilities` to sum to 1. A distribution summing to 0 is returned unchanged. */
export function normalizeDistribution(dist: ValueDistribution): ValueDistribution {
  const total = dist.probabilities.reduce((sum, p) => sum + p, 0);
  if (total === 0) {
    return dist;
  }
  return {
    minValue: dist.minValue,
    probabilities: dist.probabilities.map((p) => p / total),
  };
}

/**
 * The distribution of the sum of two independent random values, one drawn
 * from each input. Both inputs are normalised first, so the result always
 * sums to 1 regardless of the inputs' own totals.
 */
export function convolve(a: ValueDistribution, b: ValueDistribution): ValueDistribution {
  const normA = normalizeDistribution(a);
  const normB = normalizeDistribution(b);

  const minValue = normA.minValue + normB.minValue;
  const probabilities = new Array<number>(normA.probabilities.length + normB.probabilities.length - 1).fill(0);

  normA.probabilities.forEach((pa, i) => {
    normB.probabilities.forEach((pb, j) => {
      probabilities[i + j] = (probabilities[i + j] ?? 0) + pa * pb;
    });
  });

  return { minValue, probabilities };
}

/** Whether `dist`, once normalised, assigns (near-)equal probability to every value in its range. */
export function isUniform(dist: ValueDistribution): boolean {
  const { probabilities } = normalizeDistribution(dist);
  if (probabilities.length === 0) {
    return false;
  }
  const expected = 1 / probabilities.length;
  return probabilities.every((p) => Math.abs(p - expected) <= RECONVOLUTION_TOLERANCE);
}

/** A uniform distribution over the inclusive integer range [minValue, maxValueInclusive]. */
export function uniformDistribution(minValue: number, maxValueInclusive: number): ValueDistribution {
  const length = maxValueInclusive - minValue + 1;
  return {
    minValue,
    probabilities: new Array<number>(length).fill(1 / length),
  };
}

interface DistributionMismatch {
  value: number,
  expectedProbability: number,
  actualProbability: number,
}

/**
 * The first value (ascending) where `actual` diverges from `expected` by more
 * than {@link RECONVOLUTION_TOLERANCE}, or `null` if none does. Both are
 * normalised first.
 */
function findFirstMismatch(expected: ValueDistribution, actual: ValueDistribution): DistributionMismatch | null {
  const normExpected = normalizeDistribution(expected);
  const normActual = normalizeDistribution(actual);
  const lo = Math.min(normExpected.minValue, normActual.minValue);
  const hi = Math.max(maxValue(normExpected), maxValue(normActual));

  for (let value = lo; value <= hi; value++) {
    const expectedProbability = probabilityAt(normExpected, value);
    const actualProbability = probabilityAt(normActual, value);
    if (Math.abs(expectedProbability - actualProbability) > RECONVOLUTION_TOLERANCE) {
      return { value, expectedProbability, actualProbability };
    }
  }
  return null;
}

/**
 * Recovers the **bonus** from the supports of two published distributions:
 * `lesserFas = drop ⊛ bonus`, and every `drop` distribution is uniform, so
 * `bonus`'s support is exactly
 * `[lesserFas.min − drop.min, lesserFas.max − drop.max]` (see
 * docs/milestone-blessings.md, "Deriving the bonus"). Assumes the bonus itself
 * is uniform — true for every group checked so far; {@link verifyBonus} is what
 * proves that for a given row rather than just asserting it.
 *
 * One distribution, two roles: a **milestone bonus** is what enhancing to +5n
 * grants a slot that held a blessing at drop, and a **FAS bonus** is what a Full
 * Alteration Stone grants. They are independent draws from this same range,
 * which is why `fas = drop ⊛ bonus ⊛ bonus`.
 *
 * Edge cases: returns `null` if the derived range is empty (`lesserFas`
 * narrower than `drop`) — a pair that cannot describe an added bonus.
 */
export function deriveBonus(
  drop: ValueDistribution,
  lesserFas: ValueDistribution,
): ValueDistribution | null {
  const lo = lesserFas.minValue - drop.minValue;
  const hi = maxValue(lesserFas) - maxValue(drop);
  if (hi < lo) {
    return null;
  }
  return uniformDistribution(lo, hi);
}

/**
 * The independent terms that add up to one slot's **final** value, once every
 * remaining enhancement milestone has been applied. Convolving whichever terms
 * are present gives the slot's value distribution — see {@link composeSlotValue}.
 *
 * Two rules decide what goes in here, and both are subtle enough that callers
 * should not reproduce them inline (see `docs/stones.md`):
 *
 * **Which `base`** — whatever roll last set the slot:
 * - never altered, never stone-rerolled ⇒ the `drop` distribution
 * - altered ⇒ the Alteration Stone's uniform range
 * - LFAS/FAS ⇒ chosen **per slot, not per piece**. A stone re-rolls the slot's
 *   base and re-applies whatever that slot has already *earned*: the milestone
 *   bonus, if the piece had passed that slot's milestone when the stone landed.
 *   A Full stone additionally grants its own FAS bonus, always. So for a slot
 *   occupied at drop: `lfas` under a Lesser stone and `fas` under a Full one if
 *   the milestone had been reached, else `drop` and `lfas` respectively, with
 *   `bonus` below supplying the milestone when it arrives.
 * - A slot **empty at drop** never collects either term. Before its milestone a
 *   stone passes over it entirely — there is no blessing there to re-roll; after
 *   it, the stone re-rolls it onto plain `drop`. Both give `drop`, so it takes
 *   that base in every combination.
 *
 * **Whether `bonus` is present** — iff the slot is entitled to one *and* its
 * milestone checkpoint falls *after* whatever event set its base:
 * - a slot empty at drop ⇒ never: its milestone *fills* the slot rather than
 *   boosting it (see `docs/milestone-blessings.md`)
 * - a `drop` base on a slot occupied at drop ⇒ always present (the checkpoint is
 *   always later)
 * - altered *before* its checkpoint ⇒ present; altered *after* ⇒ absent, and
 *   permanently so: that slot is never enhanced again
 * - LFAS/FAS on a slot occupied at drop ⇒ present iff the piece had not yet
 *   reached that checkpoint when the stone was used; if it had, the stone's own
 *   table already includes that milestone bonus and adding one here would count
 *   it twice
 *
 * The two orders therefore agree: an occupied slot ends on `drop ⊛ bonus` under
 * a Lesser stone and `drop ⊛ bonus ⊛ bonus` under a Full one whether the stone
 * was used before or after that slot's milestone. Two bonuses is the ceiling —
 * there is no third.
 */
export interface SlotValueComposition {
  /** The roll that last set this slot: drop, an alteration stone, or a LFAS/FAS re-roll. */
  base: ValueDistribution,
  /** The refinement stone's roll, or null if the slot is unrefined. */
  refine: ValueDistribution | null,
  /** The milestone bonus, or null if this slot will never receive one. */
  bonus: ValueDistribution | null,
}

/**
 * A slot's final value distribution: `base ⊛ refine ⊛ bonus`, skipping
 * whichever terms are absent. The terms are independent rolls, so this is a
 * plain convolution chain — see {@link SlotValueComposition} for how a caller
 * decides what to put in each field.
 *
 * Edge cases: with `refine` and `bonus` both null this is just `base`
 * (normalised).
 */
export function composeSlotValue(composition: SlotValueComposition): ValueDistribution {
  const terms = [composition.base, composition.refine, composition.bonus]
    .filter((term): term is ValueDistribution => term !== null);

  return terms.reduce((total, term) => convolve(total, term));
}

/**
 * The inclusive range of values a distribution can produce — what the UI needs
 * to constrain a value input, and to label which band a player's own number
 * falls into.
 */
export function valueRange(dist: ValueDistribution): { minValue: number, maxValue: number } {
  return { minValue: dist.minValue, maxValue: maxValue(dist) };
}

export type VerifyBonusResult =
  | { isVerified: true }
  | { isVerified: false, reason: string };

/**
 * Proves a derived bonus by reconvolution: checks that `drop` is itself
 * uniform, that `drop ⊛ bonus` reproduces `lesserFas`, and that
 * `drop ⊛ bonus ⊛ bonus` reproduces `fas` — the two independent
 * confirmations `docs/milestone-blessings.md` describes ("380/380" for each,
 * across all four value groups). Fails closed (returns `isVerified: false`
 * with a `reason` naming the first divergence, never throws) the moment any
 * check doesn't hold, the way `alignLocalizedNames.ts` fails closed on name
 * alignment.
 */
export function verifyBonus(
  drop: ValueDistribution,
  lesserFas: ValueDistribution,
  fas: ValueDistribution,
  bonus: ValueDistribution,
): VerifyBonusResult {
  if (!isUniform(drop)) {
    return { isVerified: false, reason: 'the drop distribution is not uniform' };
  }

  const reconvolvedLesserFas = convolve(drop, bonus);
  const lesserFasMismatch = findFirstMismatch(lesserFas, reconvolvedLesserFas);
  if (lesserFasMismatch) {
    return {
      isVerified: false,
      reason: 'drop ⊛ bonus does not reproduce lesserFas at value '
        + `${lesserFasMismatch.value} (expected ${(lesserFasMismatch.expectedProbability * 100).toFixed(4)}%, `
        + `got ${(lesserFasMismatch.actualProbability * 100).toFixed(4)}%)`,
    };
  }

  const reconvolvedFas = convolve(reconvolvedLesserFas, bonus);
  const fasMismatch = findFirstMismatch(fas, reconvolvedFas);
  if (fasMismatch) {
    return {
      isVerified: false,
      reason: 'drop ⊛ bonus ⊛ bonus does not reproduce fas at value '
        + `${fasMismatch.value} (expected ${(fasMismatch.expectedProbability * 100).toFixed(4)}%, `
        + `got ${(fasMismatch.actualProbability * 100).toFixed(4)}%)`,
    };
  }

  return { isVerified: true };
}
