import { describe, expect, it } from 'vitest';

import {
    allBlessingOptions, alterableSlots, buildEnhancementQuery, canCalculate, canSlotBeEmpty,
    DEFAULT_ENHANCEMENT_FORM_STATE, EMPTY_SLOT_FORM_STATE, EnhancementFormState,
    guaranteedFilledCount, isAlteredOriginUnknown, isInitialGradeUnknown, isPieceReady,
    isSlotFilledAtDrop, isSlotGuaranteedEmpty, isSlotMandatory, isSlotOccupied, isSlotShapeKnown,
    MAX_ENHANCEMENT_LEVEL, normalizeTargetLevel, occupiedSlotsOf, reconcileFormState,
    SlotDisplayState, slotDisplayState, slotBlessingOptions, slotStateProblem, SlotWishState,
    slotWishState, targetLevelOptions, wishedTargets
} from './enhancement.logic';

import type { EnhancementReference } from '@shared/api/endpoints/enhancementOdds.models';
import type { SlotFormState, SlotShape } from './enhancement.logic';

function state(overrides: Partial<EnhancementFormState> = {}): EnhancementFormState {
  return { ...DEFAULT_ENHANCEMENT_FORM_STATE, ...overrides };
}

function filledSlot(overrides: Partial<SlotFormState> = {}): SlotFormState {
  return { ...EMPTY_SLOT_FORM_STATE, filled: true, blessingCode: 'ATK', value: 8, ...overrides };
}

/**
 * A wish on a slot the player hasn't filled — the cheapest thing that makes a
 * query worth sending, since a piece needs at least one of them to be asked
 * anything at all.
 */
function wishSlot(overrides: Partial<SlotFormState> = {}): SlotFormState {
  return { ...EMPTY_SLOT_FORM_STATE, wishBlessingCode: 'ATK', ...overrides };
}

/**
 * The answers that decide a piece's slot shape. `null` grade = "not sure"; the
 * target level defaults to taking the piece all the way, which is where the
 * form itself starts.
 */
function shape(
  initialGrade: number | null,
  enhancementLevel: number,
  targetEnhancementLevel: number = MAX_ENHANCEMENT_LEVEL,
): SlotShape {
  return { initialGrade, enhancementLevel, targetEnhancementLevel };
}

describe('isPieceReady', () => {
  it('is false until both equipment and quality are set', () => {
    expect(isPieceReady({ equipment: null, quality: null })).toBe(false);
    expect(isPieceReady({ equipment: 'Ebonsteel Dagger', quality: null })).toBe(false);
    expect(isPieceReady({ equipment: null, quality: 4 })).toBe(false);
    expect(isPieceReady({ equipment: 'Ebonsteel Dagger', quality: 4 })).toBe(true);
  });
});

describe('guaranteedFilledCount / isSlotShapeKnown', () => {
  it('counts only passed milestones while the grade is "not sure"', () => {
    expect(guaranteedFilledCount(shape(null, 0))).toBe(0);
    expect(guaranteedFilledCount(shape(null, 4))).toBe(0);
    expect(guaranteedFilledCount(shape(null, 10))).toBe(2);
    expect(guaranteedFilledCount(shape(null, 14))).toBe(2);
  });

  it('counts the blessings a stated grade came with', () => {
    expect(guaranteedFilledCount(shape(1, 0))).toBe(0);
    expect(guaranteedFilledCount(shape(3, 0))).toBe(2);
    expect(guaranteedFilledCount(shape(5, 0))).toBe(4);
  });

  it('takes the longer of the two prefixes, not their sum', () => {
    // A grade 3 piece at +15 carries three blessings, not five: the first two
    // milestones boosted slots it already had.
    expect(guaranteedFilledCount(shape(3, 15))).toBe(3);
    expect(guaranteedFilledCount(shape(4, 5))).toBe(3);
  });

  it('is a floor when the grade is unknown and exact when it is not', () => {
    expect(isSlotShapeKnown(shape(null, 20))).toBe(false);
    expect(isSlotShapeKnown(shape(1, 0))).toBe(true);
  });
});

describe('canSlotBeEmpty', () => {
  it('allows Empty only before a slot\'s own milestone has fired', () => {
    expect(canSlotBeEmpty(1, shape(null, 0))).toBe(true);
    expect(canSlotBeEmpty(1, shape(null, 4))).toBe(true);
    expect(canSlotBeEmpty(1, shape(null, 5))).toBe(false);
    expect(canSlotBeEmpty(1, shape(null, 20))).toBe(false);
    expect(canSlotBeEmpty(4, shape(null, 15))).toBe(true);
    expect(canSlotBeEmpty(4, shape(null, 20))).toBe(false);
  });

  it('also closes the slots a stated grade says the piece came with', () => {
    expect(canSlotBeEmpty(2, shape(3, 0))).toBe(false);
    expect(canSlotBeEmpty(3, shape(3, 0))).toBe(true);
  });
});

describe('isSlotMandatory / isSlotGuaranteedEmpty / isSlotFilledAtDrop', () => {
  it('a slot is mandatory once its own milestone has fired', () => {
    expect(isSlotMandatory(1, shape(null, 4))).toBe(false);
    expect(isSlotMandatory(1, shape(null, 5))).toBe(true);
  });

  it('a stated grade makes its own slots mandatory with no enhancement at all', () => {
    expect(isSlotMandatory(2, shape(3, 0))).toBe(true);
    expect(isSlotMandatory(3, shape(3, 0))).toBe(false);
  });

  it('nothing is guaranteed empty while the grade is unknown', () => {
    // The piece may well have dropped with more than the milestones imply.
    expect(isSlotGuaranteedEmpty(4, shape(null, 0))).toBe(false);
  });

  it('a stated grade settles the slots past its own prefix as empty', () => {
    expect(isSlotGuaranteedEmpty(3, shape(3, 0))).toBe(true);
    expect(isSlotGuaranteedEmpty(2, shape(3, 0))).toBe(false);
    // …until a milestone reaches them.
    expect(isSlotGuaranteedEmpty(3, shape(3, 15))).toBe(false);
  });

  it('separates a blessing the piece came with from one a milestone put there', () => {
    expect(isSlotFilledAtDrop(2, shape(3, 20))).toBe(true);
    expect(isSlotFilledAtDrop(3, shape(3, 20))).toBe(false);
    expect(isSlotFilledAtDrop(1, shape(null, 20))).toBe(false);
  });
});

describe('isSlotOccupied', () => {
  it('a mandatory slot counts as occupied even before the player has entered anything', () => {
    expect(isSlotOccupied(1, {}, shape(null, 5))).toBe(true);
    expect(isSlotOccupied(1, {}, shape(null, 4))).toBe(false);
    expect(isSlotOccupied(2, {}, shape(3, 0))).toBe(true);
  });

  it('a non-mandatory slot is occupied only once the player marks it Filled', () => {
    expect(isSlotOccupied(1, { 1: filledSlot() }, shape(null, 0))).toBe(true);
    expect(isSlotOccupied(1, { 1: { ...EMPTY_SLOT_FORM_STATE, filled: false } }, shape(null, 0)))
      .toBe(false);
  });

  it('ignores — rather than clears — a stale Filled once a grade is stated', () => {
    // Described under "Not sure", then the grade came back to them: slot 2 is
    // not on a grade 2 piece, but the description survives in case they
    // change their mind again.
    const slots = { 1: filledSlot(), 2: filledSlot() };
    expect(isSlotOccupied(2, slots, shape(2, 0))).toBe(false);
    expect(isSlotOccupied(2, slots, shape(null, 0))).toBe(true);
    expect(slots[2].blessingCode).toBe('ATK');
  });
});

describe('slotDisplayState', () => {
  it('leaves every non-mandatory slot toggleable, regardless of the others', () => {
    // Slot 3 marked Filled with slot 1 and 2 still untouched — a shape the
    // game can't produce, but the field itself doesn't block it; that's
    // `slotStateProblem`'s job at Calculate time.
    const slots = { 3: filledSlot() };
    expect(slotDisplayState(1, slots, shape(null, 0))).toBe(SlotDisplayState.OPTIONAL);
    expect(slotDisplayState(2, slots, shape(null, 0))).toBe(SlotDisplayState.OPTIONAL);
    expect(slotDisplayState(3, slots, shape(null, 0))).toBe(SlotDisplayState.OPTIONAL);
  });

  it('never asks about a slot the level already settled', () => {
    expect(slotDisplayState(1, {}, shape(null, 5))).toBe(SlotDisplayState.MANDATORY);
  });

  it('leaves nothing to ask once a grade is stated', () => {
    expect(slotDisplayState(1, {}, shape(3, 0))).toBe(SlotDisplayState.MANDATORY);
    expect(slotDisplayState(2, {}, shape(3, 0))).toBe(SlotDisplayState.MANDATORY);
    expect(slotDisplayState(3, {}, shape(3, 0))).toBe(SlotDisplayState.GUARANTEED_EMPTY);
    expect(slotDisplayState(4, {}, shape(3, 0))).toBe(SlotDisplayState.GUARANTEED_EMPTY);
  });
});

describe('occupiedSlotsOf', () => {
  it('reads exactly the filled flags, defaulting missing slots to false', () => {
    expect(occupiedSlotsOf({ 1: filledSlot(), 3: filledSlot() }, shape(null, 0)))
      .toEqual([true, false, true, false]);
  });

  it('folds in milestone-mandatory slots even when nothing was explicitly filled', () => {
    expect(occupiedSlotsOf({}, shape(null, 10))).toEqual([true, true, false, false]);
  });

  it('is the stated grade\'s prefix, exactly, once a grade is given', () => {
    expect(occupiedSlotsOf({}, shape(4, 0))).toEqual([true, true, true, false]);
    expect(occupiedSlotsOf({ 4: filledSlot() }, shape(4, 0))).toEqual([true, true, true, false]);
  });
});

describe('slotStateProblem', () => {
  it('is null when nothing is filled and no grade is given', () => {
    expect(slotStateProblem({}, shape(null, 0))).toBeNull();
  });

  it('is null for a normal, consistent piece', () => {
    expect(slotStateProblem({ 1: filledSlot() }, shape(null, 5))).toBeNull();
  });

  it('cannot produce a grade mismatch, because the grade now dictates the slots', () => {
    // Grade 5 (Red) implies 4 blessings at drop; the slots are read from that
    // rather than compared against it, so there is nothing left to disagree.
    expect(slotStateProblem({ 1: filledSlot() }, shape(5, 0))).toBeNull();
  });

  it('stays null when the grade is left at "not sure", however the slots are filled', () => {
    expect(slotStateProblem({ 1: filledSlot() }, shape(null, 0))).toBeNull();
  });

  it('catches a gap now that slots can be filled in any order', () => {
    // Slot 2 marked Filled with slot 1 left untouched — the shape the removed
    // top-down cascade used to prevent outright.
    const problem = slotStateProblem({ 2: filledSlot() }, shape(null, 0));
    expect(problem?.kind).toBe('GAP');
    expect(problem?.slot).toBe(1);
  });

  it('still can\'t produce a missing-milestone-fill: a mandatory slot reports occupied regardless of its stale Filled flag', () => {
    // +5 fills slot 1; marking it Empty doesn't change the occupied array,
    // because `SlotEditor` never offers a mandatory slot that toggle at all.
    expect(slotStateProblem(
      { 1: { ...EMPTY_SLOT_FORM_STATE, filled: false } },
      shape(null, 5),
    )).toBeNull();
  });
});

describe('reconcileFormState', () => {
  it('leaves an alteration on a still-occupied slot alone', () => {
    const before = state({ alteredSlot: 1, alteredFrom: 'ACC', slots: { 1: filledSlot() } });
    expect(reconcileFormState(before)).toBe(before);
  });

  it('clears an alteration stranded by a stated grade', () => {
    const after = reconcileFormState(state({
      initialGrade: 1,
      alteredSlot: 1,
      alteredFrom: 'ACC',
      slots: { 1: filledSlot() },
    }));
    expect(after.alteredSlot).toBeNull();
    expect(after.alteredFrom).toBeNull();
  });

  it('clears an alteration stranded by the level being corrected downwards', () => {
    // Declared at +5, where slot 1 was mandatory; at +0 nothing holds it up.
    const after = reconcileFormState(state({ enhancementLevel: 0, alteredSlot: 1 }));
    expect(after.alteredSlot).toBeNull();
  });
});

describe('canCalculate', () => {
  const base = { equipment: 'Ebonsteel Dagger', quality: 4 };

  it('requires the piece section and at least one wish', () => {
    expect(canCalculate(state())).toBe(false);
    expect(canCalculate(state(base))).toBe(false);
    expect(canCalculate(state({ ...base, slots: { 1: wishSlot({ wishMinValue: 16 }) } }))).toBe(true);
  });

  it('rejects a slot marked Filled with no blessing or value yet', () => {
    expect(canCalculate(state({
      ...base,
      slots: {
        1: { ...EMPTY_SLOT_FORM_STATE, filled: true },
        2: wishSlot({ wishMinValue: 16 }),
      },
    }))).toBe(false);
  });

  it('demands a description for every slot a stated grade implies', () => {
    const graded = { ...base, initialGrade: 3 };
    const wished = filledSlot({ wishMinValue: 16 });
    expect(canCalculate(state({ ...graded, slots: { 1: wished } }))).toBe(false);
    expect(canCalculate(state({ ...graded, slots: { 1: wished, 2: filledSlot() } }))).toBe(true);
  });

  it('rejects an incomplete or blocked refinement plan', () => {
    const planning = (overrides: Partial<SlotFormState>) => state({
      ...base,
      slots: { 1: filledSlot({ wishMinValue: 16, planRefine: true, ...overrides }) },
    });
    expect(canCalculate(planning({ isRefined: null }))).toBe(false);
    expect(canCalculate(planning({ isRefined: true, planRefineStoneQuality: 3 }))).toBe(false);
    expect(canCalculate(planning({ isRefined: false, planRefineStoneQuality: 3 }))).toBe(true);
  });

  it('rejects an altered slot that is not currently Filled', () => {
    expect(canCalculate(state({
      ...base,
      alteredSlot: 1,
      slots: { 2: wishSlot({ wishMinValue: 16 }) },
    }))).toBe(false);
  });
});

describe('isInitialGradeUnknown / isAlteredOriginUnknown', () => {
  it('grade unknown is exactly "not sure"', () => {
    expect(isInitialGradeUnknown(state({ initialGrade: null }))).toBe(true);
    expect(isInitialGradeUnknown(state({ initialGrade: 1 }))).toBe(false);
  });

  it('altered-origin-unknown only fires once an alteration is actually declared', () => {
    expect(isAlteredOriginUnknown(state({ alteredSlot: null, alteredFrom: null }))).toBe(false);
    expect(isAlteredOriginUnknown(state({ alteredSlot: 1, alteredFrom: null }))).toBe(true);
    expect(isAlteredOriginUnknown(state({ alteredSlot: 1, alteredFrom: 'ACC' }))).toBe(false);
  });
});

describe('alterableSlots', () => {
  it('lists only the currently occupied slots', () => {
    const slots = { 1: filledSlot(), 2: { ...EMPTY_SLOT_FORM_STATE, filled: false } };
    expect(alterableSlots(slots, shape(null, 0))).toEqual([1]);
  });

  it('includes a milestone-mandatory slot even before it is explicitly filled', () => {
    expect(alterableSlots({}, shape(null, 5))).toEqual([1]);
  });

  it('follows a stated grade\'s prefix', () => {
    expect(alterableSlots({}, shape(3, 0))).toEqual([1, 2]);
  });
});

describe('slotBlessingOptions / allBlessingOptions', () => {
  it('falls back to the full catalog when no reference data is loaded', () => {
    expect(slotBlessingOptions(1, null)).toEqual(allBlessingOptions());
  });

  it('restricts to the reference\'s nonzero rates when present', () => {
    const reference: EnhancementReference = {
      equipment: 'x', equipmentDisplayName: 'x', quality: 1, valueGroupCode: null,
      blessings: [],
      slots: [
        { slot: 1, rates: [{ blessingCode: 'ATK', rate: 1 }], isFixed: true },
      ],
      warnings: [],
    };
    expect(slotBlessingOptions(1, reference)).toEqual([{ value: 'ATK', label: expect.any(String) }]);
  });
});

describe('buildEnhancementQuery', () => {
  it('returns null until the piece section is filled', () => {
    expect(buildEnhancementQuery(state())).toBeNull();
  });

  it('omits an unfilled slot, and omits optional fields left at "not sure"', () => {
    // The worked example from `new-tool-plan.md`: a flat ATK at 8, hoping for 16.
    const query = buildEnhancementQuery(state({
      equipment: 'Ebonsteel Dagger',
      quality: 4,
      slots: {
        1: filledSlot({ wishMinValue: 16 }),
        2: { ...EMPTY_SLOT_FORM_STATE, filled: false },
      },
    }));
    expect(query).toEqual({
      equipment: 'Ebonsteel Dagger',
      quality: 4,
      enhancementLevel: 0,
      targetEnhancementLevel: 20,
      slots: [{ slot: 1, blessingCode: 'ATK', value: 8 }],
      targets: [{ blessingCode: 'ATK', minValue: 16 }],
    });
  });

  it('carries exactly the slots a stated grade implies, no more', () => {
    const query = buildEnhancementQuery(state({
      equipment: 'Ebonsteel Dagger',
      quality: 4,
      initialGrade: 2,
      // Slot 2 was described under "Not sure" and the grade has since ruled it out.
      slots: { 1: filledSlot(), 2: filledSlot({ blessingCode: 'SUR' }), 3: wishSlot() },
    }));
    expect(query?.initialGrade).toBe(2);
    expect(query?.slots).toEqual([{ slot: 1, blessingCode: 'ATK', value: 8 }]);
  });

  it('carries a ready refinement plan but never a blocked one', () => {
    const planning = (overrides: Partial<SlotFormState>) => buildEnhancementQuery(state({
      equipment: 'Ebonsteel Dagger',
      quality: 4,
      slots: {
        1: filledSlot({ planRefine: true, planRefineStoneQuality: 3, ...overrides }),
        2: wishSlot(),
      },
    }));
    expect(planning({ isRefined: false })?.slots[0]).toEqual({
      slot: 1, blessingCode: 'ATK', value: 8, isRefined: false, planRefineStoneQuality: 3,
    });
    expect(planning({ isRefined: true })?.slots[0])
      .toEqual({ slot: 1, blessingCode: 'ATK', value: 8 });
  });

  it('carries alteredSlot without alteredFrom when the origin is "not sure"', () => {
    const query = buildEnhancementQuery(state({
      equipment: 'Ebonsteel Dagger',
      quality: 4,
      alteredSlot: 1,
      alteredFrom: null,
      slots: { 1: filledSlot({ wishMinValue: 16 }) },
    }));
    expect(query?.alteredSlot).toBe(1);
    expect(query).not.toHaveProperty('alteredFrom');
  });
});

describe('slotWishState', () => {
  it('asks an occupied slot only for a value, since its blessing can no longer change', () => {
    expect(slotWishState(1, { 1: filledSlot() }, shape(null, 0)))
      .toBe(SlotWishState.VALUE_ONLY);
  });

  it('asks a slot a milestone will fill for both halves', () => {
    expect(slotWishState(3, {}, shape(null, 0))).toBe(SlotWishState.BLESSING_AND_VALUE);
  });

  it('asks nothing of an occupied slot whose milestone has already fired', () => {
    // Slot 1 was boosted at +5; nothing between +6 and +20 touches it again.
    expect(slotWishState(1, { 1: filledSlot() }, shape(null, 6)))
      .toBe(SlotWishState.NONE_FINAL);
  });

  it('asks nothing of an empty slot the target level never reaches', () => {
    expect(slotWishState(3, {}, shape(null, 0, 10))).toBe(SlotWishState.NONE_UNREACHED);
    // …and asks again the moment the player says they'll go that far.
    expect(slotWishState(3, {}, shape(null, 0, 15))).toBe(SlotWishState.BLESSING_AND_VALUE);
  });
});

describe('wishedTargets', () => {
  const base = { equipment: 'Ebonsteel Dagger', quality: 4 };

  it('emits nothing for an occupied slot left at "any value"', () => {
    // The blessing is already on the piece with no floor asked of it, so the
    // target would be satisfied by its own slot unconditionally.
    expect(wishedTargets(state({ ...base, slots: { 1: filledSlot() } }))).toEqual([]);
  });

  it('reads an occupied slot\'s wish against the blessing it already holds', () => {
    expect(wishedTargets(state({ ...base, slots: { 1: filledSlot({ wishMinValue: 16 }) } })))
      .toEqual([{ blessingCode: 'ATK', minValue: 16 }]);
  });

  it('emits a blessing-only target for an empty slot with no floor asked', () => {
    expect(wishedTargets(state({ ...base, slots: { 1: wishSlot() } })))
      .toEqual([{ blessingCode: 'ATK' }]);
  });

  it('keeps one target per wished slot, duplicates included', () => {
    // Two ATK slots at different thresholds is a real query — see
    // `docs/calculation/enhancement.md`, "Meeting the targets".
    expect(wishedTargets(state({
      ...base,
      slots: {
        1: filledSlot({ wishMinValue: 16 }),
        2: wishSlot({ wishMinValue: 8 }),
      },
    }))).toEqual([
      { blessingCode: 'ATK', minValue: 16 },
      { blessingCode: 'ATK', minValue: 8 },
    ]);
  });

  it('ignores a wish on a slot whose row is no longer asking for one', () => {
    const wished = { ...base, slots: { 3: wishSlot({ wishMinValue: 12 }) } };
    expect(wishedTargets(state(wished))).toHaveLength(1);
    // Pulling the target level back below +15 puts that wish out of reach — it
    // stops counting, but it is still there if the player changes their mind.
    const shortened = state({ ...wished, targetEnhancementLevel: 10 });
    expect(wishedTargets(shortened)).toEqual([]);
    expect(shortened.slots[3].wishMinValue).toBe(12);
  });
});

describe('targetLevelOptions', () => {
  it('offers every milestone plus staying put, for an untouched piece', () => {
    expect(targetLevelOptions(0)).toEqual([0, 5, 10, 15, 20]);
  });

  it('drops the milestones already behind the piece', () => {
    expect(targetLevelOptions(10)).toEqual([10, 15, 20]);
  });

  it('leads with the current level when it sits between two milestones', () => {
    // +14 is not a milestone, but "leave it where it is" has to be sayable —
    // and +14 is what the player would read off the item screen.
    expect(targetLevelOptions(14)).toEqual([14, 15, 20]);
  });

  it('has nothing left to choose at +20', () => {
    expect(targetLevelOptions(20)).toEqual([20]);
  });
});

describe('normalizeTargetLevel', () => {
  it('leaves a target that is still on the list alone', () => {
    expect(normalizeTargetLevel(20, 10)).toBe(20);
    expect(normalizeTargetLevel(15, 14)).toBe(15);
  });

  it('drags the target up when the current level is raised past it', () => {
    // The piece is at +14; a stored plan to reach +10 is behind it now.
    expect(normalizeTargetLevel(10, 14)).toBe(14);
  });

  it('keeps a stale "leave it here" meaning that when the current level drops', () => {
    // Correcting +14 to +10 must not invent a plan to reach +15.
    expect(normalizeTargetLevel(14, 10)).toBe(10);
  });

  it('snaps down to the milestone below rather than inventing the one above', () => {
    expect(normalizeTargetLevel(18, 0)).toBe(15);
  });
});
