import { describe, expect, it } from 'vitest';

import {
    convolve, deriveIncrement, isUniform, normalizeDistribution, uniformDistribution,
    ValueDistribution, verifyIncrement
} from './enhancementMath';

/** Builds a distribution from raw source percentages (e.g. "33.3333"), matching how the seed will read them. */
function fromPercentages(minValue: number, percentages: number[]): ValueDistribution {
  return { minValue, probabilities: percentages.map((p) => p / 100) };
}

describe('normalizeDistribution', () => {
  it('rescales probabilities to sum to 1', () => {
    const result = normalizeDistribution({ minValue: 1, probabilities: [1, 1, 2] });
    expect(result.probabilities).toEqual([0.25, 0.25, 0.5]);
  });

  it('leaves an all-zero distribution unchanged rather than dividing by zero', () => {
    const dist: ValueDistribution = { minValue: 1, probabilities: [0, 0] };
    expect(normalizeDistribution(dist)).toEqual(dist);
  });
});

describe('convolve', () => {
  it('sums two uniform ranges into the documented worked example (RANK_1_5, quality 3, flat ATK)', () => {
    // drop 5-7 (1,1,1)/3, increment 2-8 (7 values) -> lfas 7-15 (1,2,3,3,3,3,3,2,1)/21
    const drop = uniformDistribution(5, 7);
    const increment = uniformDistribution(2, 8);

    const result = convolve(drop, increment);

    expect(result.minValue).toBe(7);
    expect(result.probabilities.map((p) => Math.round(p * 21))).toEqual([1, 2, 3, 3, 3, 3, 3, 2, 1]);
  });

  it('normalises its inputs first, so unnormalised weights still convolve correctly', () => {
    const a: ValueDistribution = { minValue: 0, probabilities: [1, 1] }; // -> 0.5, 0.5
    const b: ValueDistribution = { minValue: 0, probabilities: [1, 1] };
    const result = convolve(a, b);
    expect(result.minValue).toBe(0);
    expect(result.probabilities).toEqual([0.25, 0.5, 0.25]);
  });
});

describe('isUniform', () => {
  it('is true for a distribution built by uniformDistribution', () => {
    expect(isUniform(uniformDistribution(5, 7))).toBe(true);
  });

  it('is true for a single-point distribution', () => {
    expect(isUniform({ minValue: 5, probabilities: [1] })).toBe(true);
  });

  it('is false for a distribution with unequal mass', () => {
    expect(isUniform({ minValue: 1, probabilities: [0.7, 0.3] })).toBe(false);
  });
});

describe('deriveIncrement', () => {
  it('recovers U{2..8} from the documented worked example (RANK_1_5, quality 3, flat ATK)', () => {
    const drop = uniformDistribution(5, 7);
    const lesserFas = uniformDistribution(7, 15);

    const increment = deriveIncrement(drop, lesserFas);

    expect(increment).toEqual(uniformDistribution(2, 8));
  });

  it('recovers U{2..5} for RANK_1_5, quality 2, flat ATK', () => {
    const drop = uniformDistribution(3, 5);
    const lesserFas = uniformDistribution(5, 10);

    expect(deriveIncrement(drop, lesserFas)).toEqual(uniformDistribution(2, 5));
  });

  it('returns null when lesserFas is narrower than drop — no added term can explain it', () => {
    const drop = uniformDistribution(5, 7);
    const lesserFas: ValueDistribution = { minValue: 6, probabilities: [1] };

    expect(deriveIncrement(drop, lesserFas)).toBeNull();
  });
});

describe('verifyIncrement', () => {
  it('verifies the documented worked example (RANK_1_5, quality 3, flat ATK) using exact fractions', () => {
    const drop = uniformDistribution(5, 7);
    const lesserFas: ValueDistribution = { minValue: 7, probabilities: [1, 2, 3, 3, 3, 3, 3, 2, 1].map((n) => n / 21) };
    // drop ⊛ increment ⊛ increment — matches docs/milestone-blessings.md (fixed there
    // after this test caught a transcription error: an earlier version of that row
    // didn't sum to its own stated denominator). Cross-checked against the real
    // scraped percentages in the "rounding-realistic" case below.
    const fas: ValueDistribution = {
      minValue: 9,
      probabilities: [1, 3, 6, 9, 12, 15, 18, 19, 18, 15, 12, 9, 6, 3, 1].map((n) => n / 147),
    };
    const increment = deriveIncrement(drop, lesserFas)!;

    expect(verifyIncrement(drop, lesserFas, fas, increment)).toEqual({ isVerified: true });
  });

  it('verifies against the literal published percentages (RANK_1_5, quality 3, flat ATK) — the rounding-realistic case', () => {
    // Fetched from the live page (2026-08-23) to prove the tolerance survives real
    // 4-decimal-place rounding, not just idealised exact fractions. This is the
    // regression that stops anyone tightening RECONVOLUTION_TOLERANCE back to 1e-9.
    const drop = fromPercentages(5, [33.3333, 33.3333, 33.3333]);
    const lesserFas = fromPercentages(
      7,
      [4.7619, 9.5238, 14.2857, 14.2857, 14.2857, 14.2857, 14.2857, 9.5238, 4.7619],
    );
    const fas = fromPercentages(
      9,
      [0.6803, 2.0408, 4.0816, 6.1224, 8.1633, 10.2041, 12.2449, 12.9252, 12.2449, 10.2041, 8.1633, 6.1224, 4.0816, 2.0408, 0.6803],
    );
    const increment = deriveIncrement(drop, lesserFas)!;

    expect(increment).toEqual(uniformDistribution(2, 8));
    expect(verifyIncrement(drop, lesserFas, fas, increment)).toEqual({ isVerified: true });
  });

  it('verifies a second real row (RANK_1_5, quality 2, flat ATK) from the live page', () => {
    const drop = fromPercentages(3, [33.3333, 33.3333, 33.3333]);
    const lesserFas = fromPercentages(5, [8.3333, 16.6667, 25, 25, 16.6667, 8.3333]);
    const fas = fromPercentages(7, [2.0833, 6.25, 12.5, 18.75, 20.8333, 18.75, 12.5, 6.25, 2.0833]);
    const increment = deriveIncrement(drop, lesserFas)!;

    expect(increment).toEqual(uniformDistribution(2, 5));
    expect(verifyIncrement(drop, lesserFas, fas, increment)).toEqual({ isVerified: true });
  });

  it('fails closed, naming the divergent value, when drop is not uniform', () => {
    const drop: ValueDistribution = { minValue: 5, probabilities: [0.7, 0.3] };
    const lesserFas = uniformDistribution(7, 9);
    const fas = uniformDistribution(9, 13);
    const increment = uniformDistribution(2, 4);

    const result = verifyIncrement(drop, lesserFas, fas, increment);

    expect(result.isVerified).toBe(false);
    if (result.isVerified) {
      throw new Error('expected verification to fail');
    }
    expect(result.reason).toMatch(/drop distribution is not uniform/);
  });

  it('fails closed, naming the divergent value, when fas does not match the reconvolution', () => {
    const drop = uniformDistribution(5, 7);
    // The real (correctly-shaped) lesserFas, so the first check passes and the
    // mismatch is isolated to the fas check this test is actually about.
    const lesserFas: ValueDistribution = { minValue: 7, probabilities: [1, 2, 3, 3, 3, 3, 3, 2, 1].map((n) => n / 21) };
    const increment = deriveIncrement(drop, lesserFas)!;
    // A fas distribution that does not match drop ⊛ increment ⊛ increment (which
    // is triangular, not flat).
    const wrongFas = uniformDistribution(9, 23);

    const result = verifyIncrement(drop, lesserFas, wrongFas, increment);

    expect(result.isVerified).toBe(false);
    if (result.isVerified) {
      throw new Error('expected verification to fail');
    }
    expect(result.reason).toMatch(/does not reproduce fas at value/);
  });
});
