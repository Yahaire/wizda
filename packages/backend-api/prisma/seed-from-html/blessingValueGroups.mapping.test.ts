import { describe, expect, it } from 'vitest';

import { EquipmentRankKind } from '@shared/domain/rank';

import {
    assignValueGroups, EquipmentForGroupAssignment, hasValueGroupAssignmentDrift
} from './blessingValueGroups.mapping';
import { BlessingValueSelectorKind, ParsedValueGroup } from './blessingValueRates.models';

const NO_DRIFT = {
  withoutRank: [],
  withoutGroup: [],
  namedTokensUnmatched: [],
  namedOutsideRange: [],
};

/** Builds a `ParsedValueGroup` with sensible defaults, overridable per test. */
function group(overrides: Partial<ParsedValueGroup['selector']> & { orderIndex?: number }): ParsedValueGroup {
  const { orderIndex = 0, ...selector } = overrides;
  return {
    orderIndex,
    selector: {
      code: 'GROUP',
      label: 'Group',
      rankOrderMin: 1,
      rankOrderMax: 6,
      kind: BlessingValueSelectorKind.RANK_RANGE,
      tokens: [],
      ...selector,
    },
  };
}

function equipment(overrides: Partial<EquipmentForGroupAssignment>): EquipmentForGroupAssignment {
  return { id: overrides.name ?? 'id', name: 'Item', rank: null, categoryCode: null, ...overrides };
}

// Ordinals from EQUIPMENT_RANKS: Worn 1, Bronze 2, Iron 3, Steel 4, Ebonsteel 5, Silver 6.
const RANK_1_5 = group({ code: 'RANK_1_5', rankOrderMin: 1, rankOrderMax: 5, kind: BlessingValueSelectorKind.RANK_RANGE });
const RANK_6_NAMED = group({
  code: 'RANK_6_NAMED',
  rankOrderMin: 6,
  rankOrderMax: 6,
  kind: BlessingValueSelectorKind.NAMED,
  tokens: ['Librarian Rod', 'Master Ring'],
});
const RANK_6_CATEGORY = group({
  code: 'RANK_6_CATEGORY',
  rankOrderMin: 6,
  rankOrderMax: 6,
  kind: BlessingValueSelectorKind.CATEGORY,
  tokens: ['TWO_HANDED_SWORD', 'CESTI'],
});
const RANK_6_FALLBACK = group({
  code: 'RANK_6_FALLBACK',
  rankOrderMin: 6,
  rankOrderMax: 6,
  kind: BlessingValueSelectorKind.FALLBACK,
});
const FOUR_GROUPS = [RANK_1_5, RANK_6_NAMED, RANK_6_CATEGORY, RANK_6_FALLBACK];

describe('assignValueGroups', () => {
  it('assigns a rank 1-5 piece to the RANK_RANGE group', () => {
    const dagger = equipment({ id: '1', name: 'Bronze Dagger', rank: EquipmentRankKind.BRONZE });

    // RANK_1_5 alone here: FOUR_GROUPS' RANK_6_NAMED tokens would otherwise report
    // as unmatched against this single-item catalog, which is a different test below.
    const { groupCodeById, drift } = assignValueGroups([RANK_1_5], [dagger]);

    expect(groupCodeById.get('1')).toBe('RANK_1_5');
    expect(drift).toEqual(NO_DRIFT);
  });

  it('checks the named list before the category rule', () => {
    // A Silver Two-Handed Sword that is ALSO one of the 15 named pieces would be
    // ambiguous between NAMED and CATEGORY — NAMED must win.
    const namedTwoHander = equipment({
      id: '2', name: 'Librarian Rod', rank: EquipmentRankKind.SILVER, categoryCode: 'TWO_HANDED_SWORD',
    });

    const { groupCodeById } = assignValueGroups(FOUR_GROUPS, [namedTwoHander]);

    expect(groupCodeById.get('2')).toBe('RANK_6_NAMED');
  });

  it('assigns a Silver 2H-melee piece to the category group when not named', () => {
    const sword = equipment({ id: '3', name: 'Some Other Sword', rank: EquipmentRankKind.SILVER, categoryCode: 'TWO_HANDED_SWORD' });

    const { groupCodeById } = assignValueGroups(FOUR_GROUPS, [sword]);

    expect(groupCodeById.get('3')).toBe('RANK_6_CATEGORY');
  });

  it('falls back for a Silver piece that is neither named nor in the category set', () => {
    const shield = equipment({ id: '4', name: 'Silver Shield', rank: EquipmentRankKind.SILVER, categoryCode: 'SMALL_SHIELD' });

    const { groupCodeById } = assignValueGroups(FOUR_GROUPS, [shield]);

    expect(groupCodeById.get('4')).toBe('RANK_6_FALLBACK');
  });

  it('records equipment with no rank as withoutRank, and assigns it no group', () => {
    const unranked = equipment({ id: '5', name: 'Mystery Item', rank: null });

    const { groupCodeById, drift } = assignValueGroups(FOUR_GROUPS, [unranked]);

    expect(groupCodeById.has('5')).toBe(false);
    expect(drift.withoutRank).toEqual(['Mystery Item']);
    expect(hasValueGroupAssignmentDrift(drift)).toBe(true);
  });

  it('records a ranked piece with no covering group as withoutGroup', () => {
    const gap = group({ code: 'RANK_1', rankOrderMin: 1, rankOrderMax: 1, kind: BlessingValueSelectorKind.RANK_RANGE });
    const bronzeItem = equipment({ id: '6', name: 'Bronze Item', rank: EquipmentRankKind.BRONZE }); // ordinal 2, no group covers it

    const { groupCodeById, drift } = assignValueGroups([gap], [bronzeItem]);

    expect(groupCodeById.has('6')).toBe(false);
    expect(drift.withoutGroup).toEqual(['Bronze Item']);
  });

  it('never assigns an UNKNOWN-kind group to anything', () => {
    const unknownGroup = group({
      code: 'RANK_6_UNKNOWN', rankOrderMin: 6, rankOrderMax: 6, kind: BlessingValueSelectorKind.UNKNOWN, tokens: ['weird'],
    });
    const silverItem = equipment({ id: '7', name: 'weird', rank: EquipmentRankKind.SILVER });

    const { groupCodeById, drift } = assignValueGroups([unknownGroup], [silverItem]);

    expect(groupCodeById.has('7')).toBe(false);
    expect(drift.withoutGroup).toEqual(['weird']);
  });

  it('reports a NAMED token that matches no equipment in the current catalog', () => {
    const { drift } = assignValueGroups([RANK_6_NAMED], [
      equipment({ id: '8', name: 'Librarian Rod', rank: EquipmentRankKind.SILVER }),
      // 'Master Ring' from RANK_6_NAMED's tokens is never in the catalog here.
    ]);

    expect(drift.namedTokensUnmatched).toEqual(['Master Ring']);
  });

  it('reports a NAMED token whose matched equipment sits outside the group\'s rank range', () => {
    // Matches by name, but its rank (Bronze, ordinal 2) is outside RANK_6_NAMED's 6-6 range.
    const misranked = equipment({ id: '9', name: 'Librarian Rod', rank: EquipmentRankKind.BRONZE });

    const { drift } = assignValueGroups([RANK_6_NAMED], [misranked]);

    expect(drift.namedOutsideRange).toEqual(['Librarian Rod (BRONZE)']);
  });

  it('sorts drift so the report is stable between runs', () => {
    const { drift } = assignValueGroups(FOUR_GROUPS, [
      equipment({ id: 'a', name: 'Zebra Item', rank: null }),
      equipment({ id: 'b', name: 'Alpha Item', rank: null }),
    ]);

    expect(drift.withoutRank).toEqual(['Alpha Item', 'Zebra Item']);
  });
});
