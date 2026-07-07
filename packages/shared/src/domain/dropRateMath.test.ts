import { describe, expect, it } from 'vitest';

import {
  DropRateRow,
  junksNeededForConfidence,
  matchProbabilityForJunk,
} from './dropRateMath';

// ---------------------------------------------------------------------------
// Test helpers: a seeded RNG + categorical sampler, so the Monte-Carlo checks
// below are deterministic (no flaky CI) yet exercise the real distributions.
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) — returns floats in [0, 1). */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample a 0-based index from (possibly unnormalised) categorical weights. */
function sampleIndex(weights: readonly number[], u: number): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let threshold = u * total;
  for (let i = 0; i < weights.length; i++) {
    threshold -= weights[i];
    if (threshold < 0) {
      return i;
    }
  }
  return weights.length - 1;
}

interface TaggedRow extends DropRateRow {
  equipmentId: string,
}

/**
 * One draw from a full junk: pick a (group, equipment) row by
 * `groupDropRate · dropRate`, then a quality and a grade independently — the
 * exact generative process `matchProbabilityForJunk` models.
 */
function sampleJunkOutcome(
  rows: readonly TaggedRow[],
  rng: () => number,
): { equipmentId: string, quality: number, grade: number } {
  const rowWeights = rows.map((row) => row.groupDropRate * row.dropRate);
  const row = rows[sampleIndex(rowWeights, rng())];
  return {
    equipmentId: row.equipmentId,
    quality: sampleIndex(row.qualityRates, rng()) + 1,
    grade: sampleIndex(row.gradeRates, rng()) + 1,
  };
}

// ---------------------------------------------------------------------------
// junksNeededForConfidence — hand-computable exact cases + edge cases
// ---------------------------------------------------------------------------

describe('junksNeededForConfidence', () => {
  it('matches the pen-and-paper ceil(ln/ln) value', () => {
    // ln(0.01) / ln(0.68) = 11.94… → 12
    expect(junksNeededForConfidence(0.32, 0.99)).toBe(12);
  });

  it('returns null when the target is impossible (p <= 0)', () => {
    expect(junksNeededForConfidence(0, 0.99)).toBeNull();
    expect(junksNeededForConfidence(-0.1, 0.99)).toBeNull();
  });

  it('returns 1 when already guaranteed per draw (p >= 1)', () => {
    expect(junksNeededForConfidence(1, 0.99)).toBe(1);
    expect(junksNeededForConfidence(1.5, 0.99)).toBe(1);
  });

  it('rejects an out-of-range confidence', () => {
    expect(() => junksNeededForConfidence(0.3, 1)).toThrow(RangeError);
    expect(() => junksNeededForConfidence(0.3, 0)).toThrow(RangeError);
    expect(() => junksNeededForConfidence(0.3, 1.2)).toThrow(RangeError);
  });

  it('is the minimal n that reaches the confidence (threshold property)', () => {
    const p = 0.137;
    const c = 0.95;
    const n = junksNeededForConfidence(p, c)!;
    // n reaches c, n-1 does not.
    expect(1 - (1 - p) ** n).toBeGreaterThanOrEqual(c);
    expect(1 - (1 - p) ** (n - 1)).toBeLessThan(c);
  });
});

// ---------------------------------------------------------------------------
// matchProbabilityForJunk — hand-computable exact cases
// ---------------------------------------------------------------------------

describe('matchProbabilityForJunk', () => {
  const singleRow: DropRateRow = {
    groupDropRate: 1,
    dropRate: 0.5,
    qualityRates: [0.8, 0.15, 0.05, 0, 0],
    gradeRates: [0.8, 0.15, 0.05, 0, 0],
  };

  it('multiplies group · equip · quality-mass · grade-mass', () => {
    // 1 · 0.5 · 0.8 · 0.8 = 0.32
    expect(matchProbabilityForJunk([singleRow], { quality: [1], grade: [1] })).toBeCloseTo(0.32, 12);
  });

  it('treats empty/omitted axes as wildcards (factor 1)', () => {
    // 1 · 0.5 · 1 · 1
    expect(matchProbabilityForJunk([singleRow], {})).toBeCloseTo(0.5, 12);
    expect(matchProbabilityForJunk([singleRow], { quality: [], grade: [] })).toBeCloseTo(0.5, 12);
  });

  it('sums the accepted levels within an axis (OR)', () => {
    // quality ∈ {1,2} → 0.95 ; grade any → 1 ; 0.5 · 0.95 · 1
    expect(matchProbabilityForJunk([singleRow], { quality: [1, 2] })).toBeCloseTo(0.475, 12);
  });

  it('ignores out-of-range levels and de-dupes', () => {
    // quality ∈ {1, 1, 0, 6} → only level 1 counts → 0.8 ; 0.5 · 0.8
    expect(matchProbabilityForJunk([singleRow], { quality: [1, 1, 0, 6] })).toBeCloseTo(0.4, 12);
  });

  it('sums mutually-exclusive rows across groups', () => {
    const rows: DropRateRow[] = [
      {
        groupDropRate: 0.7,
        dropRate: 0.5,
        qualityRates: [1, 0, 0, 0, 0],
        gradeRates: [1, 0, 0, 0, 0],
      },
      {
        groupDropRate: 0.3,
        dropRate: 1,
        qualityRates: [1, 0, 0, 0, 0],
        gradeRates: [1, 0, 0, 0, 0],
      },
    ];
    // 0.7·0.5·1·1 + 0.3·1·1·1 = 0.35 + 0.3 = 0.65
    expect(matchProbabilityForJunk(rows, { quality: [1], grade: [1] })).toBeCloseTo(0.65, 12);
  });
});

// ---------------------------------------------------------------------------
// Monte-Carlo cross-check — the analytic formula must match the frequency of
// the generative process it claims to summarise. This is the "simulate draws"
// safety net: if our reading of the model were wrong, these would diverge.
// ---------------------------------------------------------------------------

describe('Monte-Carlo cross-check', () => {
  // A full junk (row weights sum to 1) with two groups and three equipment.
  const fullJunk: TaggedRow[] = [
    {
      equipmentId: 'common',
      groupDropRate: 0.6,
      dropRate: 0.7,
      qualityRates: [0.8, 0.15, 0.05, 0, 0],
      gradeRates: [0.7, 0.2, 0.1, 0, 0],
    },
    {
      equipmentId: 'uncommon',
      groupDropRate: 0.6,
      dropRate: 0.3,
      qualityRates: [0.5, 0.3, 0.15, 0.05, 0],
      gradeRates: [0.4, 0.3, 0.2, 0.1, 0],
    },
    {
      equipmentId: 'rare',
      groupDropRate: 0.4,
      dropRate: 1,
      qualityRates: [0.2, 0.2, 0.3, 0.2, 0.1],
      gradeRates: [0.1, 0.2, 0.3, 0.2, 0.2],
    },
  ];

  it('P(match | junk) equals the empirical hit rate (with equipment + quality + grade filters)', () => {
    const acceptedEquipment = new Set(['uncommon', 'rare']);
    const query = { quality: [3, 4, 5], grade: [2, 3] };

    // Analytic: the calc receives only the accepted-equipment rows.
    const analytic = matchProbabilityForJunk(
      fullJunk.filter((row) => acceptedEquipment.has(row.equipmentId)),
      query,
    );

    // Empirical: draw from the FULL junk; a draw of unaccepted equipment is a miss.
    const rng = makeRng(0x1234abcd);
    const draws = 400_000;
    let hits = 0;
    for (let i = 0; i < draws; i++) {
      const outcome = sampleJunkOutcome(fullJunk, rng);
      if (
        acceptedEquipment.has(outcome.equipmentId)
        && query.quality.includes(outcome.quality)
        && query.grade.includes(outcome.grade)
      ) {
        hits++;
      }
    }
    const empirical = hits / draws;

    // ~5 standard errors for this p and draw count is well under 0.005.
    expect(empirical).toBeCloseTo(analytic, 2);
  });

  it('confidence formula: n junks reach the requested confidence in simulation', () => {
    const p = matchProbabilityForJunk(
      fullJunk.filter((row) => row.equipmentId === 'rare'),
      { quality: [4, 5], grade: [4, 5] },
    );
    const confidence = 0.9;
    const n = junksNeededForConfidence(p, confidence)!;

    const rng = makeRng(0x0f0f0f0f);
    const trials = 200_000;
    let anySuccess = 0;
    for (let t = 0; t < trials; t++) {
      let hit = false;
      for (let i = 0; i < n; i++) {
        if (rng() < p) {
          hit = true;
        }
      }
      if (hit) {
        anySuccess++;
      }
    }
    const empirical = anySuccess / trials;

    // Matches the closed form 1 − (1 − p)^n, and clears the requested threshold.
    expect(empirical).toBeCloseTo(1 - (1 - p) ** n, 2);
    expect(empirical).toBeGreaterThanOrEqual(confidence - 0.01);
  });
});
