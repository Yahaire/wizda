/**
 * Enhancement math — the pure, Prisma-free core of "what value does a
 * blessing end up at after enhancing?".
 *
 * Derivation, rationale, and the milestone model are documented in
 * `docs/milestone-blessings.md`. Keep this module free of DB/HTTP concerns so
 * it stays trivially unit-testable (see `enhancementMath.test.ts`).
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
 * (`drop ⊛ increment ⊛ increment`, a double convolution) compounds that to
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
 * Recovers the milestone increment from the supports of two published
 * distributions: `lesserFas = drop ⊛ increment`, and every `drop` distribution
 * is uniform, so `increment`'s support is exactly
 * `[lesserFas.min − drop.min, lesserFas.max − drop.max]` (see
 * docs/milestone-blessings.md, "Deriving the milestone increment"). Assumes
 * the increment itself is uniform — true for every group checked so far;
 * {@link verifyIncrement} is what proves that for a given row rather than just
 * asserting it.
 *
 * Edge cases: returns `null` if the derived range is empty (`lesserFas`
 * narrower than `drop`) — a pair that cannot describe an added increment.
 */
export function deriveIncrement(
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

export type VerifyIncrementResult =
  | { isVerified: true }
  | { isVerified: false, reason: string };

/**
 * Proves a derived increment by reconvolution: checks that `drop` is itself
 * uniform, that `drop ⊛ increment` reproduces `lesserFas`, and that
 * `drop ⊛ increment ⊛ increment` reproduces `fas` — the two independent
 * confirmations `docs/milestone-blessings.md` describes ("380/380" for each,
 * across all four value groups). Fails closed (returns `isVerified: false`
 * with a `reason` naming the first divergence, never throws) the moment any
 * check doesn't hold, the way `alignLocalizedNames.ts` fails closed on name
 * alignment.
 */
export function verifyIncrement(
  drop: ValueDistribution,
  lesserFas: ValueDistribution,
  fas: ValueDistribution,
  increment: ValueDistribution,
): VerifyIncrementResult {
  if (!isUniform(drop)) {
    return { isVerified: false, reason: 'the drop distribution is not uniform' };
  }

  const reconvolvedLesserFas = convolve(drop, increment);
  const lesserFasMismatch = findFirstMismatch(lesserFas, reconvolvedLesserFas);
  if (lesserFasMismatch) {
    return {
      isVerified: false,
      reason: 'drop ⊛ increment does not reproduce lesserFas at value '
        + `${lesserFasMismatch.value} (expected ${(lesserFasMismatch.expectedProbability * 100).toFixed(4)}%, `
        + `got ${(lesserFasMismatch.actualProbability * 100).toFixed(4)}%)`,
    };
  }

  const reconvolvedFas = convolve(reconvolvedLesserFas, increment);
  const fasMismatch = findFirstMismatch(fas, reconvolvedFas);
  if (fasMismatch) {
    return {
      isVerified: false,
      reason: 'drop ⊛ increment ⊛ increment does not reproduce fas at value '
        + `${fasMismatch.value} (expected ${(fasMismatch.expectedProbability * 100).toFixed(4)}%, `
        + `got ${(fasMismatch.actualProbability * 100).toFixed(4)}%)`,
    };
  }

  return { isVerified: true };
}
