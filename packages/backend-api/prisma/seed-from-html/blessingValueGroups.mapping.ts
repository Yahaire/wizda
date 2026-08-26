import { EQUIPMENT_RANKS, EquipmentRankKind } from '@shared/domain/rank';

import { BlessingValueSelectorKind, ParsedValueGroup } from './blessingValueRates.models';

/**
 * Pure assignment of `Equipment.blessingValueGroupCode`, mirroring
 * `equipmentTaxonomy.mapping.ts` exactly: pure module, no Prisma, no I/O,
 * unrecognised/unmatched cases are **recorded, not thrown** (see
 * {@link ValueGroupAssignmentDrift}). See docs/milestone-blessings.md, "The
 * four value groups", for the assignment rule this implements.
 */

/** The minimal shape this module needs from an `Equipment` row. */
export interface EquipmentForGroupAssignment {
  id: string;
  name: string;
  rank: EquipmentRankKind | null;
  categoryCode: string | null;
}

const RANK_ORDER_INDEX: ReadonlyMap<EquipmentRankKind, number> = new Map(
  EQUIPMENT_RANKS.map((rank) => [rank.kind, rank.orderIndex]),
);

/**
 * Priority a matching {@link BlessingValueSelectorKind} is chosen at, lowest
 * first — the order docs/milestone-blessings.md specifies: check the named
 * list before the category rule, and the fallback only once nothing more
 * specific claimed the piece. `UNKNOWN` never matches (its rates still store,
 * unlinked — see the parser's degradation ladder).
 */
const SELECTOR_PRIORITY: Readonly<Record<BlessingValueSelectorKind, number>> = {
  [BlessingValueSelectorKind.NAMED]: 0,
  [BlessingValueSelectorKind.CATEGORY]: 1,
  [BlessingValueSelectorKind.RANK_RANGE]: 2,
  [BlessingValueSelectorKind.FALLBACK]: 3,
  [BlessingValueSelectorKind.UNKNOWN]: Number.POSITIVE_INFINITY,
};

/** Whether `group` claims `equipment`, independent of any other group also claiming it. */
function groupClaims(group: ParsedValueGroup, equipment: EquipmentForGroupAssignment, rankOrder: number): boolean {
  if (rankOrder < group.selector.rankOrderMin || rankOrder > group.selector.rankOrderMax) {
    return false;
  }
  switch (group.selector.kind) {
    case BlessingValueSelectorKind.NAMED:
      return group.selector.tokens.includes(equipment.name);
    case BlessingValueSelectorKind.CATEGORY:
      return equipment.categoryCode !== null && group.selector.tokens.includes(equipment.categoryCode);
    case BlessingValueSelectorKind.RANK_RANGE:
    case BlessingValueSelectorKind.FALLBACK:
      return true;
    case BlessingValueSelectorKind.UNKNOWN:
      return false;
  }
}

/**
 * Unrecognised/unmatched cases seen while assigning value groups, deduplicated
 * and sorted. Non-empty means a human should look (a new piece the game added
 * whose rank we haven't enriched yet, or a genuine mismatch); the seed itself
 * still completes.
 */
export interface ValueGroupAssignmentDrift {
  /** Equipment with no `rank` at all — expected for a few items, no group is derivable. */
  withoutRank: string[];
  /** Equipment with a `rank` that matched no group — every rank should have at least a RANK_RANGE/FALLBACK catch-all, so this means a range gap. */
  withoutGroup: string[];
  /** A `NAMED` group's token that matched no equipment name in the current catalog at all. */
  namedTokensUnmatched: string[];
  /** A `NAMED` group's token matched an equipment name, but that equipment's rank sits outside the group's own rank range — formatted "token (equipment rank)". */
  namedOutsideRange: string[];
}

/** Whether any drift at all was recorded — the trigger for the ACTION REQUIRED report. */
export function hasValueGroupAssignmentDrift(drift: ValueGroupAssignmentDrift): boolean {
  return (
    drift.withoutRank.length > 0
    || drift.withoutGroup.length > 0
    || drift.namedTokensUnmatched.length > 0
    || drift.namedOutsideRange.length > 0
  );
}

export interface AssignValueGroupsResult {
  /** Equipment id -> the `BlessingValueGroup.code` it rolls on. */
  groupCodeById: Map<string, string>;
  drift: ValueGroupAssignmentDrift;
}

function toSortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/**
 * Assigns every ranked `Equipment` row to the `BlessingValueGroup` it rolls
 * on: among the groups whose rank range covers the piece, the first match
 * wins in {@link SELECTOR_PRIORITY} order (NAMED, then CATEGORY, then
 * RANK_RANGE, then FALLBACK). A piece with no `rank`, or one whose rank range
 * has no covering group at all, gets no group — both recorded in
 * {@link ValueGroupAssignmentDrift} rather than thrown.
 */
export function assignValueGroups(
  groups: readonly ParsedValueGroup[],
  equipment: readonly EquipmentForGroupAssignment[],
): AssignValueGroupsResult {
  const sortedGroups = [...groups].sort(
    (left, right) => SELECTOR_PRIORITY[left.selector.kind] - SELECTOR_PRIORITY[right.selector.kind],
  );

  const groupCodeById = new Map<string, string>();
  const withoutRank: string[] = [];
  const withoutGroup: string[] = [];

  for (const item of equipment) {
    if (item.rank === null) {
      withoutRank.push(item.name);
      continue;
    }
    const rankOrder = RANK_ORDER_INDEX.get(item.rank);
    if (rankOrder === undefined) {
      withoutRank.push(item.name);
      continue;
    }

    const match = sortedGroups.find((group) => groupClaims(group, item, rankOrder));
    if (match) {
      groupCodeById.set(item.id, match.selector.code);
    } else {
      withoutGroup.push(item.name);
    }
  }

  const equipmentByName = new Map(equipment.map((item) => [item.name, item]));
  const namedTokensUnmatched: string[] = [];
  const namedOutsideRange: string[] = [];
  for (const group of groups) {
    if (group.selector.kind !== BlessingValueSelectorKind.NAMED) {
      continue;
    }
    for (const token of group.selector.tokens) {
      const match = equipmentByName.get(token);
      if (!match) {
        namedTokensUnmatched.push(token);
        continue;
      }
      const rankOrder = match.rank !== null ? RANK_ORDER_INDEX.get(match.rank) : undefined;
      if (
        rankOrder === undefined
        || rankOrder < group.selector.rankOrderMin
        || rankOrder > group.selector.rankOrderMax
      ) {
        namedOutsideRange.push(`${token} (${match.rank ?? 'no rank'})`);
      }
    }
  }

  return {
    groupCodeById,
    drift: {
      withoutRank: toSortedUnique(withoutRank),
      withoutGroup: toSortedUnique(withoutGroup),
      namedTokensUnmatched: toSortedUnique(namedTokensUnmatched),
      namedOutsideRange: toSortedUnique(namedOutsideRange),
    },
  };
}
