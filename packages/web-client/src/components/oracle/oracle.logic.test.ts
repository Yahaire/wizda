import { describe, expect, it } from 'vitest';

import { EquipmentRankKind } from '@shared/domain/rank';

import {
    activeFilters, DEFAULT_FILTERS, EMPTY_FILTERS, gradeFloorFor, hasAnyFilter, levelsFrom,
    MIN_LEVEL, OracleFilters, qualityDisplay, resolveQuery, subjectIdentity, subjectOf, wasNarrowed
} from './oracle.logic';

import type { MatchedOutcome } from '@shared/api/endpoints/junkToGuarantee.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
function filters(overrides: Partial<OracleFilters> = {}): OracleFilters {
  return { ...EMPTY_FILTERS, ...overrides, };
}

function equipmentList(...items: Partial<EquipmentListItem>[]): Map<string, EquipmentListItem> {
  const map = new Map<string, EquipmentListItem>();
  for (const item of items) {
    map.set(item.name!, {
      name: item.name!,
      displayName: item.name!,
      category: item.category ?? null,
      rank: item.rank ?? null,
      maxDropQuality: null,
      maxDropGrade: null,
      blessings: [],
      sources: [],
    });
  }
  return map;
}

const AXE = { code: 'TWO_HANDED_AXE', name: 'Two-Handed Axe' };
const ROBE = { code: 'CLOTHES', name: 'Clothes' };

/** The subject as it reads for a query nothing has narrowed yet. */
function subjectFor(overrides: Partial<OracleFilters>): string {
  return subjectOf(resolveQuery(null, filters(overrides))).text;
}

describe('subjectOf', () => {
  it('names the equipment when the player picked some', () => {
    expect(subjectFor({ equipment: ['Frost Dagger'] })).toBe('Frost Dagger');
    expect(subjectFor({ equipment: ['Frost Dagger', 'Sunfang'] })).toBe('Frost Dagger or Sunfang');
    expect(subjectFor({ equipment: ['Frost Dagger', 'Sunfang', 'Ember Bow'] }))
      .toBe('Frost Dagger, Sunfang, or Ember Bow');
  });

  it('caps a long equipment list, holding the overflow back for the "+N more" affordance', () => {
    const subject = subjectOf(resolveQuery(null, filters({
      equipment: ['Frost Dagger', 'Sunfang', 'Ember Bow', 'Gale Axe', 'Tide Staff'],
    })));

    // No trailing "or" — the visible list isn't the whole list.
    expect(subject.text).toBe('Frost Dagger, Sunfang, Ember Bow');
    expect(subject.hidden).toEqual(['Gale Axe', 'Tide Staff']);
  });

  it('ignores rank and category once equipment is named — narrowing already reflects them', () => {
    expect(subjectFor({
      equipment: ['Frost Dagger'],
      rank: [EquipmentRankKind.SILVER],
      category: ['DAGGER'],
    })).toBe('Frost Dagger');
  });

  it('describes an unnamed query as "Any <rank> <category>"', () => {
    expect(subjectFor({ rank: [EquipmentRankKind.SILVER] })).toBe('Any Silver equipment');
    expect(subjectFor({ category: ['ONE_HANDED_AXE'] })).toBe('Any One-Handed Axe');
    expect(subjectFor({ rank: [EquipmentRankKind.SILVER], category: ['ONE_HANDED_AXE'] }))
      .toBe('Any Silver One-Handed Axe');
  });

  it('treats a lone rank as an adjective even across several categories', () => {
    expect(subjectFor({
      rank: [EquipmentRankKind.SILVER],
      category: ['ONE_HANDED_AXE', 'TWO_HANDED_AXE'],
    })).toBe('Any Silver One-Handed Axe or Two-Handed Axe');
  });

  it('keeps several ranks inline while there is at most one category', () => {
    expect(subjectFor({ rank: [EquipmentRankKind.SILVER, EquipmentRankKind.EBONSTEEL] }))
      .toBe('Any Silver or Ebonsteel equipment');
    expect(subjectFor({
      rank: [EquipmentRankKind.SILVER, EquipmentRankKind.EBONSTEEL],
      category: ['ODACHI'],
    })).toBe('Any Silver or Ebonsteel Odachi');
  });

  it('parenthesises the ranks when both axes are plural, which would otherwise be ambiguous', () => {
    expect(subjectFor({
      rank: [EquipmentRankKind.SILVER, EquipmentRankKind.EBONSTEEL],
      category: ['ODACHI', 'KATANA'],
    })).toBe('Any Odachi or Katana (Silver or Ebonsteel)');
  });

  it('falls back to "Any equipment" when only quality/grade/blessings are set', () => {
    expect(subjectFor({ minQuality: 5, minGrade: 5, blessings: ['ATK'] })).toBe('Any equipment');
  });

  it('describes the narrowed equipment, not everything the player asked for', () => {
    const matched: MatchedOutcome = { equipment: ['Beastskin Robe'] };
    const query = resolveQuery(matched, filters({ equipment: ['Silver Axe', 'Beastskin Robe'] }));

    expect(subjectOf(query).text).toBe('Beastskin Robe');
  });
});

describe('levelsFrom', () => {
  it('spells a minimum out as itself and everything above it', () => {
    expect(levelsFrom(4)).toEqual([4, 5]);
    expect(levelsFrom(5)).toEqual([5]);
  });

  it('is a wildcard at the bottom of the scale, where every level qualifies', () => {
    expect(levelsFrom(MIN_LEVEL)).toEqual([]);
  });
});

describe('activeFilters', () => {
  it('sends a minimum as the levels it accepts', () => {
    expect(activeFilters(filters({ minQuality: 3, minGrade: 4 })))
      .toEqual({ quality: [3, 4, 5], grade: [4, 5] });
  });

  it('omits an axis whose minimum accepts everything, so the API sees a wildcard', () => {
    expect(activeFilters(filters({ minQuality: MIN_LEVEL, minGrade: MIN_LEVEL }))).toEqual({});
  });
});

describe('hasAnyFilter', () => {
  it('does not count a minimum that accepts every level', () => {
    expect(hasAnyFilter(filters())).toBe(false);
    expect(hasAnyFilter(filters({ minGrade: MIN_LEVEL }))).toBe(false);
    expect(hasAnyFilter(filters({ minGrade: 2 }))).toBe(true);
  });

  // A player who lands and hits Calculate must get an answer, not the NO_QUERY snark.
  it('counts the filters a first-time player starts with', () => {
    expect(hasAnyFilter(DEFAULT_FILTERS)).toBe(true);
    expect(activeFilters(DEFAULT_FILTERS)).toEqual({ quality: [3, 4, 5], grade: [3, 4, 5] });
  });
});

describe('gradeFloorFor', () => {
  it('demands one active blessing slot per blessing — slots being grade − 1', () => {
    expect(gradeFloorFor(0)).toBe(MIN_LEVEL);
    expect(gradeFloorFor(1)).toBe(2);
    expect(gradeFloorFor(4)).toBe(5);
  });
});

describe('resolveQuery', () => {
  it('stands in the raw query when no match set arrived', () => {
    const raw = filters({ equipment: ['Frost Dagger'], minQuality: 3 });

    expect(resolveQuery(null, raw))
      .toMatchObject({ equipment: ['Frost Dagger'], quality: [3, 4, 5] });
  });

  it('falls back per-axis, since a wildcard axis is absent from the match set', () => {
    // The junk narrowed quality; grade was never filtered, so it stays empty.
    const resolved = resolveQuery({ quality: [3] }, filters({ minQuality: 3 }));

    expect(resolved.quality).toEqual([3]);
    expect(resolved.grade).toEqual([]);
  });

  it('never narrows blessings — the AND set is required in full', () => {
    const resolved = resolveQuery({ quality: [3] }, filters({ minQuality: 3, blessings: ['ATK', 'CRIT'] }));

    expect(resolved.blessings).toEqual(['ATK', 'CRIT']);
  });
});

describe('wasNarrowed', () => {
  // The best each level axis reaches across the whole selection — what the sliders showed.
  const ceilings = (quality = 5, grade = 5) => ({ quality, grade });

  it('is false without a match set, and when nothing was dropped', () => {
    expect(wasNarrowed(null, filters({ minQuality: 4 }), ceilings())).toBe(false);
    expect(wasNarrowed({ quality: [4, 5] }, filters({ minQuality: 4 }), ceilings())).toBe(false);
  });

  it('ignores a junk that hits the selection\'s own ceiling — the sliders already showed it', () => {
    // The gear only ever reaches 3★ Blue, and this junk drops it there: no news.
    expect(wasNarrowed({ quality: [3] }, filters({ minQuality: 3 }), ceilings(3, 5))).toBe(false);
    expect(wasNarrowed({ grade: [3] }, filters({ minGrade: 3 }), ceilings(5, 3))).toBe(false);
  });

  it('flags a junk that falls below what the rest of the selection can reach', () => {
    // Some junks drop this at 5★ Red (ceiling 5), but this one caps at 4★.
    expect(wasNarrowed({ quality: [3, 4] }, filters({ minQuality: 3 }), ceilings(5, 5))).toBe(true);
    expect(wasNarrowed({ grade: [3, 4] }, filters({ minGrade: 3 }), ceilings(5, 5))).toBe(true);
  });

  it('is true when the junk drops fewer of the pieces the player asked for', () => {
    expect(wasNarrowed(
      { equipment: ['Beastskin Robe'] },
      filters({ equipment: ['Silver Axe', 'Beastskin Robe'] }),
      ceilings(),
    )).toBe(true);
  });
});

describe('subjectIdentity', () => {
  const known = equipmentList(
    { name: 'Silver Axe', category: AXE, rank: EquipmentRankKind.SILVER },
    { name: 'Earthrend Axe', category: AXE, rank: EquipmentRankKind.EBONSTEEL },
    { name: 'Blackwing Robe', category: ROBE, rank: EquipmentRankKind.SILVER },
    { name: 'Nameless Thing', category: null, rank: null },
  );

  it('reads a named piece\'s own category and rank, ignoring the filter axes', () => {
    const query = resolveQuery(null, filters({
      equipment: ['Silver Axe'],
      rank: [EquipmentRankKind.EBONSTEEL],
    }));

    expect(subjectIdentity(query, known)).toEqual({
      categoryCode: 'TWO_HANDED_AXE',
      rankKinds: [EquipmentRankKind.SILVER],
    });
  });

  it('keeps the shared category across several pieces, collecting their ranks ascending', () => {
    const query = resolveQuery(null, filters({ equipment: ['Earthrend Axe', 'Silver Axe'] }));

    expect(subjectIdentity(query, known)).toEqual({
      categoryCode: 'TWO_HANDED_AXE',
      rankKinds: [EquipmentRankKind.EBONSTEEL, EquipmentRankKind.SILVER],
    });
  });

  it('forfeits the category when the pieces disagree — no icon means "an axe or a robe"', () => {
    const query = resolveQuery(null, filters({ equipment: ['Silver Axe', 'Blackwing Robe'] }));

    expect(subjectIdentity(query, known).categoryCode).toBeNull();
  });

  it('forfeits the category when a piece has no taxonomy', () => {
    const query = resolveQuery(null, filters({ equipment: ['Silver Axe', 'Nameless Thing'] }));

    expect(subjectIdentity(query, known).categoryCode).toBeNull();
  });

  it('falls back to the queried axes when nothing is named', () => {
    const query = resolveQuery(null, filters({
      category: ['TWO_HANDED_AXE'],
      rank: [EquipmentRankKind.SILVER, EquipmentRankKind.BRONZE],
    }));

    expect(subjectIdentity(query, known)).toEqual({
      categoryCode: 'TWO_HANDED_AXE',
      // Ascending by rank strength, not by the order the filter listed them.
      rankKinds: [EquipmentRankKind.BRONZE, EquipmentRankKind.SILVER],
    });
  });

  it('has no category when several were queried, and none when the axis is a wildcard', () => {
    const several = resolveQuery(null, filters({ category: ['TWO_HANDED_AXE', 'CLOTHES'] }));
    expect(subjectIdentity(several, known).categoryCode).toBeNull();

    const wildcard = resolveQuery(null, filters({ minQuality: 5 }));
    expect(subjectIdentity(wildcard, known)).toEqual({ categoryCode: null, rankKinds: [] });
  });
});

describe('qualityDisplay', () => {
  it('draws a single level as written stars, matching the game', () => {
    expect(qualityDisplay([4])).toEqual({ kind: 'stars', value: 4 });
  });

  it('lists a two-level set rather than ranging it — "3★/4★" beats "3★–4★"', () => {
    expect(qualityDisplay([3, 4])).toEqual({ kind: 'levels', values: [3, 4] });
    expect(qualityDisplay([4, 5])).toEqual({ kind: 'levels', values: [4, 5] });
  });

  it('ranges a contiguous run once it is long enough to be worth compressing', () => {
    expect(qualityDisplay([2, 3, 4])).toEqual({ kind: 'range', from: 2, to: 4 });
    expect(qualityDisplay([1, 2, 3, 4, 5])).toEqual({ kind: 'range', from: 1, to: 5 });
  });

  it('lists a gapped set compactly, ascending, however long', () => {
    expect(qualityDisplay([4, 2])).toEqual({ kind: 'levels', values: [2, 4] });
    expect(qualityDisplay([5, 1, 2, 4])).toEqual({ kind: 'levels', values: [1, 2, 4, 5] });
  });

  it('is nothing at all for a wildcard axis', () => {
    expect(qualityDisplay([])).toBeNull();
  });
});
