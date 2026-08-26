import { describe, expect, it } from 'vitest';

import { buildBlessingValueBonuses, toDistributions } from './blessingValueBonuses';
import { ParsedValueRow } from './blessingValueRates.models';

/** Builds sparse `ParsedValueRow`s from a dense `[minValue, ...rates]` list — `rate: 0` entries are skipped, matching the real parser (a "-" cell never becomes a row). */
function rowsFor(
  groupCode: string,
  sourceCode: string,
  quality: number,
  blessingCode: string,
  minValue: number,
  rates: readonly number[],
): ParsedValueRow[] {
  return rates
    .map((rate, i) => ({ groupCode, sourceCode, quality, blessingCode, value: minValue + i, rate }))
    .filter((row) => row.rate > 0);
}

// The documented worked example (docs/milestone-blessings.md): RANK_1_5,
// quality 3, flat ATK. drop 5-7 flat, lfas 7-15 trapezoid, fas 9-23 bell,
// bonus 2-8. Same fixture enhancementMath.test.ts uses for `verifyBonus`.
const DROP_5_7 = rowsFor('RANK_1_5', 'DROP', 3, 'ATK', 5, [1 / 3, 1 / 3, 1 / 3]);
const LFAS_7_15 = rowsFor(
  'RANK_1_5', 'LFAS', 3, 'ATK', 7,
  [1, 2, 3, 3, 3, 3, 3, 2, 1].map((n) => n / 21),
);
const FAS_9_23 = rowsFor(
  'RANK_1_5', 'FAS', 3, 'ATK', 9,
  [1, 3, 6, 9, 12, 15, 18, 19, 18, 15, 12, 9, 6, 3, 1].map((n) => n / 147),
);

describe('toDistributions', () => {
  it('builds one dense distribution per (group, source, quality, blessing) key from sparse rows', () => {
    const distributions = toDistributions(DROP_5_7);

    expect(distributions.size).toBe(1);
    const dist = distributions.get('RANK_1_5|DROP|3|ATK');
    expect(dist).toEqual({ minValue: 5, probabilities: [1 / 3, 1 / 3, 1 / 3] });
  });

  it('fills a gap in the middle of the range with 0, not by shrinking the range', () => {
    // Value 6 impossible (no row), 5 and 7 possible — same shape a real "-" cell produces.
    const rows: ParsedValueRow[] = [
      { groupCode: 'G', sourceCode: 'DROP', quality: 1, blessingCode: 'ATK', value: 5, rate: 0.5 },
      { groupCode: 'G', sourceCode: 'DROP', quality: 1, blessingCode: 'ATK', value: 7, rate: 0.5 },
    ];

    const dist = toDistributions(rows).get('G|DROP|1|ATK');

    expect(dist).toEqual({ minValue: 5, probabilities: [0.5, 0, 0.5] });
  });

  it('keeps distinct groups/sources/qualities/blessings on separate keys', () => {
    const distributions = toDistributions([...DROP_5_7, ...LFAS_7_15]);
    expect(distributions.size).toBe(2);
    expect(distributions.has('RANK_1_5|DROP|3|ATK')).toBe(true);
    expect(distributions.has('RANK_1_5|LFAS|3|ATK')).toBe(true);
  });
});

describe('buildBlessingValueBonuses', () => {
  it('derives and verifies the documented worked example end to end', () => {
    const { bonuses, missingSources } = buildBlessingValueBonuses([...DROP_5_7, ...LFAS_7_15, ...FAS_9_23]);

    expect(missingSources).toEqual([]);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]).toMatchObject({
      groupCode: 'RANK_1_5',
      quality: 3,
      blessingCode: 'ATK',
      minValue: 2,
      isVerified: true,
      verificationNote: null,
    });
    expect(bonuses[0]!.probabilities).toHaveLength(7); // 2..8 inclusive
  });

  it('reports a DROP triple with no LFAS counterpart as missing, rather than a bonus row', () => {
    const { bonuses, missingSources } = buildBlessingValueBonuses([...DROP_5_7]);

    expect(bonuses).toEqual([]);
    expect(missingSources).toEqual([{ groupCode: 'RANK_1_5', quality: 3, blessingCode: 'ATK' }]);
  });

  it('still stores the bonus, flagged unverified, when the FAS distribution does not reproduce the reconvolution', () => {
    // Same drop/lfas as the worked example (so deriveBonus succeeds), but a fas
    // that isn't drop ⊛ bonus ⊛ bonus (flat instead of bell-shaped).
    const wrongFas = rowsFor('RANK_1_5', 'FAS', 3, 'ATK', 9, new Array(15).fill(1 / 15));

    const { bonuses, missingSources } = buildBlessingValueBonuses([...DROP_5_7, ...LFAS_7_15, ...wrongFas]);

    expect(missingSources).toEqual([]);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]!.isVerified).toBe(false);
    expect(bonuses[0]!.verificationNote).toMatch(/does not reproduce fas/);
    // The bonus itself is still the correctly-derived one — only verification failed.
    expect(bonuses[0]!.minValue).toBe(2);
    expect(bonuses[0]!.probabilities).toHaveLength(7);
  });

  it('stores an unverified bonus with no probabilities when lesserFas is narrower than drop', () => {
    const narrowLfas = rowsFor('RANK_1_5', 'LFAS', 3, 'ATK', 6, [1]); // single point, inside drop's own range

    const { bonuses } = buildBlessingValueBonuses([...DROP_5_7, ...narrowLfas]);

    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]!.isVerified).toBe(false);
    expect(bonuses[0]!.probabilities).toEqual([]);
    expect(bonuses[0]!.verificationNote).toMatch(/narrower than drop/);
  });

  it('still stores the bonus, flagged unverified, when there is no FAS distribution to check against at all', () => {
    // DROP + LFAS present (so deriveBonus succeeds), no FAS rows anywhere for this triple.
    const { bonuses, missingSources } = buildBlessingValueBonuses([...DROP_5_7, ...LFAS_7_15]);

    expect(missingSources).toEqual([]);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]).toMatchObject({ minValue: 2, isVerified: false });
    expect(bonuses[0]!.verificationNote).toBe('no matching FAS distribution to verify against');
  });

  it('flags unverified when FAS rows exist for a different triple only', () => {
    const otherFas = rowsFor('RANK_1_5', 'FAS', 4, 'ATK', 9, [1]); // different quality, so it never matches

    const { bonuses } = buildBlessingValueBonuses([...DROP_5_7, ...LFAS_7_15, ...otherFas]);

    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]!.isVerified).toBe(false);
    expect(bonuses[0]!.verificationNote).toBe('no matching FAS distribution to verify against');
  });

  it('processes multiple independent (group, quality, blessing) triples', () => {
    const dropQ2 = rowsFor('RANK_1_5', 'DROP', 2, 'ATK', 3, [1 / 3, 1 / 3, 1 / 3]);
    const lfasQ2 = rowsFor('RANK_1_5', 'LFAS', 2, 'ATK', 5, [8.3333, 16.6667, 25, 25, 16.6667, 8.3333].map((p) => p / 100));
    const fasQ2 = rowsFor(
      'RANK_1_5', 'FAS', 2, 'ATK', 7,
      [2.0833, 6.25, 12.5, 18.75, 20.8333, 18.75, 12.5, 6.25, 2.0833].map((p) => p / 100),
    );

    const { bonuses } = buildBlessingValueBonuses([
      ...DROP_5_7, ...LFAS_7_15, ...FAS_9_23,
      ...dropQ2, ...lfasQ2, ...fasQ2,
    ]);

    expect(bonuses).toHaveLength(2);
    const byQuality = new Map(bonuses.map((bonus) => [bonus.quality, bonus]));
    expect(byQuality.get(3)).toMatchObject({ minValue: 2, isVerified: true });
    expect(byQuality.get(2)).toMatchObject({ minValue: 2, isVerified: true });
    expect(byQuality.get(2)!.probabilities).toHaveLength(4); // 2..5 inclusive
  });
});
