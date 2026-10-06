import { describe, expect, it } from 'vitest';

import {
    checkBlessingSlotState, filledSlotCount, forEachSlotAssignment, milestoneForSlot,
    SlotStateProblemKind
} from './blessingSlots';

/** A slot's published row, written as a plain object for readability. */
function slot(rates: Record<string, number>): ReadonlyMap<string, number> {
  return new Map(Object.entries(rates));
}

const NONE = new Set<string>();

/** Every visited assignment with its probability — the walk's full output. */
function collect(
  slots: readonly ReadonlyMap<string, number>[],
  excluded: ReadonlySet<string> = NONE,
  mustCover: ReadonlySet<string> = NONE,
): { assignment: string[], probability: number }[] {
  const seen: { assignment: string[], probability: number }[] = [];
  forEachSlotAssignment(slots, excluded, mustCover, (assignment, probability) => {
    // The buffer is reused across visits, so copy — this doubles as the test
    // that callers are told to copy it.
    seen.push({ assignment: [...assignment], probability });
  });
  return seen;
}

function totalOf(visits: { probability: number }[]): number {
  return visits.reduce((sum, visit) => sum + visit.probability, 0);
}

describe('forEachSlotAssignment', () => {
  it('enumerates every ordering and sums to 1 over all assignments', () => {
    const slots = [
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
    ];

    const visits = collect(slots);

    // 3 choices then 2 survivors = 6 ordered assignments, none repeating.
    expect(visits).toHaveLength(6);
    expect(visits.every(({ assignment }) => assignment[0] !== assignment[1])).toBe(true);
    expect(totalOf(visits)).toBeCloseTo(1, 12);
  });

  it('renormalises over the survivors, not over 1', () => {
    const slots = [
      slot({ ATK: 0.5, DEF: 0.5 }),
      slot({ ATK: 0.25, DEF: 0.25, SUR: 0.5 }),
    ];

    const visits = collect(slots);

    // Slot 1 takes ATK (0.5); slot 2 then chooses between DEF (0.25) and SUR
    // (0.5), renormalised over 0.75 — so DEF is 1/3 of the remainder, not 0.25.
    const atkThenDef = visits.find(({ assignment }) => assignment[0] === 'ATK' && assignment[1] === 'DEF');
    expect(atkThenDef?.probability).toBeCloseTo(0.5 * (0.25 / 0.75), 12);
  });

  it('skips zero-rate blessings entirely', () => {
    const visits = collect([slot({ ATK: 0.6, DEF: 0.4, SUR: 0 })]);

    expect(visits.map(({ assignment }) => assignment[0]).sort()).toEqual(['ATK', 'DEF']);
    expect(totalOf(visits)).toBeCloseTo(1, 12);
  });

  it('visits nothing when a slot has no rows at all', () => {
    expect(collect([slot({ ATK: 1 }), slot({})])).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // mustCover — the pruning the Junk Oracle relies on.
  // -------------------------------------------------------------------------

  it('pruning changes which assignments are visited but not their probabilities', () => {
    const slots = [
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
    ];
    const required = new Set(['ATK', 'SUR']);

    const all = collect(slots);
    const pruned = collect(slots, NONE, required);

    // Every pruned visit is an unpruned visit with the identical probability,
    // so pruning is purely a filter — it never reweights a surviving path.
    const covering = all.filter(
      ({ assignment }) => assignment.includes('ATK') && assignment.includes('SUR'),
    );
    expect(totalOf(pruned)).toBeCloseTo(totalOf(covering), 12);
    expect(pruned).toHaveLength(covering.length);
  });

  it('visits nothing when more blessings are required than there are slots', () => {
    const slots = [slot({ ATK: 0.5, DEF: 0.5 })];
    expect(collect(slots, NONE, new Set(['ATK', 'DEF']))).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // excluded — what the Enhancement Oracle adds. The piece already displays
  // some blessings; the slots walked here are the ones milestones will fill.
  // -------------------------------------------------------------------------

  it('skips an excluded blessing in every slot, as if an earlier slot had taken it', () => {
    const slots = [
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
    ];

    const visits = collect(slots, new Set(['ATK']));

    expect(visits.map(({ assignment }) => assignment)).toEqual([
      ['DEF', 'SUR'],
      ['SUR', 'DEF'],
    ]);
  });

  it('renormalises over what survives the exclusion, so the total is still 1', () => {
    const slots = [
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
      slot({ ATK: 0.5, DEF: 0.3, SUR: 0.2 }),
    ];

    // The chain continues from where the piece's history left off: slot 1 draws
    // DEF or SUR in the ratio 0.3 : 0.2, not at their published 30% / 20%.
    const visits = collect(slots, new Set(['ATK']));

    expect(totalOf(visits)).toBeCloseTo(1, 12);
    expect(visits[0]?.probability).toBeCloseTo(0.3 / 0.5, 12);
  });

  it('visits nothing when the exclusions leave a slot nothing to roll', () => {
    expect(collect([slot({ ATK: 1 })], new Set(['ATK']))).toEqual([]);
  });

  it('ignores an exclusion the slots could never roll anyway', () => {
    const slots = [slot({ ATK: 0.5, DEF: 0.5 }), slot({ ATK: 0.5, DEF: 0.5 })];
    expect(collect(slots, new Set(['MAG']))).toEqual(collect(slots));
  });

  it('cannot cover a blessing that is excluded', () => {
    const slots = [slot({ ATK: 0.5, DEF: 0.5 }), slot({ ATK: 0.5, DEF: 0.5 })];
    expect(collect(slots, new Set(['ATK']), new Set(['ATK']))).toEqual([]);
  });

  it('visits once, at probability 1, when there is nothing left to roll', () => {
    const visits = collect([], new Set(['ATK', 'DEF']));

    expect(visits).toHaveLength(1);
    expect(visits[0]?.probability).toBe(1);
    expect(visits[0]?.assignment).toEqual([]);
  });
});

describe('milestoneForSlot', () => {
  it('places the four milestones at +5, +10, +15 and +20', () => {
    expect([1, 2, 3, 4].map(milestoneForSlot)).toEqual([5, 10, 15, 20]);
  });
});

describe('filledSlotCount', () => {
  it('counts the blessings a piece dropped with before any milestone lands', () => {
    // Grade counts blessings plus one, so blue (grade 3) drops with two.
    expect(filledSlotCount(3, 0)).toBe(2);
    expect(filledSlotCount(1, 0)).toBe(0);
  });

  it('takes the larger of the drop prefix and the milestone prefix, never their sum', () => {
    // A blue piece at +10 has had slots 1 and 2 boosted, not filled — still two.
    expect(filledSlotCount(3, 10)).toBe(2);
    // At +15 the third milestone fills slot 3, taking it to three.
    expect(filledSlotCount(3, 15)).toBe(3);
    // A White piece reaches the same count purely through milestones.
    expect(filledSlotCount(1, 15)).toBe(3);
  });

  it('never exceeds the four slots a piece has', () => {
    expect(filledSlotCount(5, 20)).toBe(4);
  });
});

describe('checkBlessingSlotState', () => {
  it('accepts a plain blue piece before its milestones', () => {
    expect(checkBlessingSlotState([true, true, false, false], 0, 3)).toBeNull();
  });

  it('accepts a White piece whose milestones have filled the prefix', () => {
    expect(checkBlessingSlotState([true, true, true, false], 15, 1)).toBeNull();
  });

  it('rejects a gap, since slots fill top to bottom', () => {
    const problem = checkBlessingSlotState([true, false, true, false], 0, null);

    expect(problem?.kind).toBe(SlotStateProblemKind.GAP);
    expect(problem?.slot).toBe(2);
  });

  it('rejects a slot left empty after its own milestone has passed', () => {
    const problem = checkBlessingSlotState([true, false, false, false], 10, null);

    expect(problem?.kind).toBe(SlotStateProblemKind.MISSING_MILESTONE_FILL);
    expect(problem?.slot).toBe(2);
    expect(problem?.message).toContain('+10');
  });

  it('rejects a stated grade at drop that disagrees with the filled slots', () => {
    // Blue at +0 dropped with two blessings; one filled row is a mis-entry —
    // most likely the grade picker, since nothing about the slots is impossible
    // on its own. No milestone has passed, so only the grade check can see it.
    const problem = checkBlessingSlotState([true, false, false, false], 0, 3);

    expect(problem?.kind).toBe(SlotStateProblemKind.GRADE_MISMATCH);
    expect(problem?.slot).toBeNull();
    expect(problem?.message).toContain('grade 3');
  });

  it('prefers the slot-level reason when a state breaks more than one rule', () => {
    // Blue at +15 should carry three. Reported with two, the empty slot 3 is
    // both a missing milestone fill and a grade mismatch — the slot-level
    // message names what to fix, so it wins.
    const problem = checkBlessingSlotState([true, true, false, false], 15, 3);

    expect(problem?.kind).toBe(SlotStateProblemKind.MISSING_MILESTONE_FILL);
    expect(problem?.slot).toBe(3);
  });

  it('skips the grade check when the player did not state a grade', () => {
    expect(checkBlessingSlotState([true, true, true, false], 15, null)).toBeNull();
  });

  it('cannot tell a blue piece from a White one at +15 by its slots alone', () => {
    // The whole reason initialGrade is worth asking for: both states are real,
    // both show three filled slots, and only the stated grade separates them.
    expect(checkBlessingSlotState([true, true, true, false], 15, 3)).toBeNull();
    expect(checkBlessingSlotState([true, true, true, false], 15, 1)).toBeNull();
  });
});
