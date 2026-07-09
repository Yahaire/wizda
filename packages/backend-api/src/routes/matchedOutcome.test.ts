import { describe, expect, it } from 'vitest';

import { buildMatchedOutcome, MatchedCandidate } from './matchedOutcome';

import type { DropRateRow } from '@shared/domain/dropRateMath';

/**
 * A drop row that always drops (rates of 1), rolling only the given quality and
 * grade levels. Rates need not normalise — the assembly only ever asks whether a
 * probability is nonzero.
 */
function row(
  qualities: number[],
  grades: number[],
  gradePresence?: number[],
): DropRateRow {
  const spread = (levels: number[]) => (
    Array.from({ length: 5 }, (_unused, index) => (levels.includes(index + 1) ? 1 : 0))
  );
  return {
    groupDropRate: 1,
    dropRate: 1,
    qualityRates: spread(qualities),
    gradeRates: spread(grades),
    ...(gradePresence ? { gradePresence } : {}),
  };
}

function candidate(
  name: string,
  tier: string | null,
  categoryCode: string | null,
  rows: DropRateRow[],
): MatchedCandidate {
  return { name, tier, categoryCode, rows, };
}

describe('buildMatchedOutcome', () => {
  it('drops quality levels the junk cannot roll for the contributing equipment', () => {
    const axe = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [row([1, 2, 3], [1, 2, 3, 4, 5])]);

    const matched = buildMatchedOutcome([axe], { quality: [3, 4] }, {});

    expect(matched.quality).toEqual([3]);
  });

  it('keeps every queried level the junk can reach', () => {
    const axe = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [row([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])]);

    const matched = buildMatchedOutcome([axe], { quality: [3, 4] }, {});

    expect(matched.quality).toEqual([3, 4]);
  });

  it('omits axes the query left as wildcards', () => {
    const axe = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [row([1, 2], [1, 2])]);

    const matched = buildMatchedOutcome([axe], {}, {});

    expect(matched).toEqual({});
  });

  it('drops equipment this junk does not usefully drop, preserving the queried order', () => {
    const reachable = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [row([4], [5])]);
    // Only ever rolls ★1, so a ★4 query gets nothing from it.
    const unreachable = candidate('Earthrend Axe', 'EBONSTEEL', 'TWO_HANDED_AXE', [row([1], [5])]);

    const matched = buildMatchedOutcome(
      [unreachable, reachable],
      { quality: [4] },
      { equipment: ['Silver Axe', 'Earthrend Axe'] },
    );

    expect(matched.equipment).toEqual(['Silver Axe']);
  });

  it('collapses tier and category to those the contributing equipment actually have', () => {
    const silver = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [row([4], [5])]);
    const ebon = candidate('Earthrend Axe', 'EBONSTEEL', 'ONE_HANDED_AXE', [row([1], [5])]);

    const matched = buildMatchedOutcome(
      [silver, ebon],
      { quality: [4] },
      { tier: ['SILVER', 'EBONSTEEL'], category: ['TWO_HANDED_AXE', 'ONE_HANDED_AXE'] },
    );

    expect(matched.tier).toEqual(['SILVER']);
    expect(matched.category).toEqual(['TWO_HANDED_AXE']);
  });

  it('excludes equipment that cannot carry the required blessings', () => {
    // A weapon that can't roll the required blessing carries the route's
    // NO_BLESSING_PRESENCE vector, so its grade factor is zero at every grade.
    const weapon = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [
      row([4], [5], [0, 0, 0, 0, 0]),
    ]);
    const armor = candidate('Beastskin Robe', 'SILVER', 'LIGHT_ARMOR', [
      row([4], [5], [0, 0, 0, 0, 1]),
    ]);

    const matched = buildMatchedOutcome(
      [weapon, armor],
      { grade: [5] },
      { equipment: ['Silver Axe', 'Beastskin Robe'], category: ['TWO_HANDED_AXE', 'LIGHT_ARMOR'] },
    );

    expect(matched.equipment).toEqual(['Beastskin Robe']);
    expect(matched.category).toEqual(['LIGHT_ARMOR']);
  });

  it('drops grades with too few slots to hold the required blessings', () => {
    // Grade 5 (four slots) can hold them; grade 3 (two slots) cannot.
    const armor = candidate('Beastskin Robe', 'SILVER', 'LIGHT_ARMOR', [
      row([4], [3, 5], [0, 0, 0, 0, 1]),
    ]);

    const matched = buildMatchedOutcome([armor], { grade: [3, 5] }, {});

    expect(matched.grade).toEqual([5]);
  });

  it('returns nothing when no equipment contributes', () => {
    const axe = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [row([1], [1])]);

    const matched = buildMatchedOutcome([axe], { quality: [5] }, { equipment: ['Silver Axe'] });

    expect(matched).toEqual({});
  });

  it('de-duplicates a repeated filter value', () => {
    const axe = candidate('Silver Axe', 'SILVER', 'TWO_HANDED_AXE', [row([4], [5])]);

    const matched = buildMatchedOutcome(
      [axe],
      {},
      { equipment: ['Silver Axe', 'Silver Axe'] },
    );

    expect(matched.equipment).toEqual(['Silver Axe']);
  });
});
