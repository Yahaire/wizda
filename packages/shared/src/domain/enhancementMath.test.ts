import { describe, expect, it } from 'vitest';

import { MAX_BLESSING_SLOTS } from './blessingSlots';
import {
    composeSlotValue, convolve, deriveBonus, enhancementOdds, EnhancementOddsInput,
    EnhancementOddsResult, EnhancementSlotInput, isUniform, normalizeDistribution, pointMass,
    probabilityAtLeast, uniformDistribution, ValueDistribution, valueRange, verifyBonus
} from './enhancementMath';
import { getStoneValueRange } from './stoneValues';

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
    // drop 5-7 (1,1,1)/3, bonus 2-8 (7 values) -> lfas 7-15 (1,2,3,3,3,3,3,2,1)/21
    const drop = uniformDistribution(5, 7);
    const bonus = uniformDistribution(2, 8);

    const result = convolve(drop, bonus);

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

describe('deriveBonus', () => {
  it('recovers U{2..8} from the documented worked example (RANK_1_5, quality 3, flat ATK)', () => {
    const drop = uniformDistribution(5, 7);
    const lesserFas = uniformDistribution(7, 15);

    const bonus = deriveBonus(drop, lesserFas);

    expect(bonus).toEqual(uniformDistribution(2, 8));
  });

  it('recovers U{2..5} for RANK_1_5, quality 2, flat ATK', () => {
    const drop = uniformDistribution(3, 5);
    const lesserFas = uniformDistribution(5, 10);

    expect(deriveBonus(drop, lesserFas)).toEqual(uniformDistribution(2, 5));
  });

  it('returns null when lesserFas is narrower than drop — no added term can explain it', () => {
    const drop = uniformDistribution(5, 7);
    const lesserFas: ValueDistribution = { minValue: 6, probabilities: [1] };

    expect(deriveBonus(drop, lesserFas)).toBeNull();
  });
});

describe('verifyBonus', () => {
  it('verifies the documented worked example (RANK_1_5, quality 3, flat ATK) using exact fractions', () => {
    const drop = uniformDistribution(5, 7);
    const lesserFas: ValueDistribution = { minValue: 7, probabilities: [1, 2, 3, 3, 3, 3, 3, 2, 1].map((n) => n / 21) };
    // drop ⊛ bonus ⊛ bonus — matches docs/milestone-blessings.md (fixed there
    // after this test caught a transcription error: an earlier version of that row
    // didn't sum to its own stated denominator). Cross-checked against the real
    // scraped percentages in the "rounding-realistic" case below.
    const fas: ValueDistribution = {
      minValue: 9,
      probabilities: [1, 3, 6, 9, 12, 15, 18, 19, 18, 15, 12, 9, 6, 3, 1].map((n) => n / 147),
    };
    const bonus = deriveBonus(drop, lesserFas)!;

    expect(verifyBonus(drop, lesserFas, fas, bonus)).toEqual({ isVerified: true });
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
    const bonus = deriveBonus(drop, lesserFas)!;

    expect(bonus).toEqual(uniformDistribution(2, 8));
    expect(verifyBonus(drop, lesserFas, fas, bonus)).toEqual({ isVerified: true });
  });

  it('verifies a second real row (RANK_1_5, quality 2, flat ATK) from the live page', () => {
    const drop = fromPercentages(3, [33.3333, 33.3333, 33.3333]);
    const lesserFas = fromPercentages(5, [8.3333, 16.6667, 25, 25, 16.6667, 8.3333]);
    const fas = fromPercentages(7, [2.0833, 6.25, 12.5, 18.75, 20.8333, 18.75, 12.5, 6.25, 2.0833]);
    const bonus = deriveBonus(drop, lesserFas)!;

    expect(bonus).toEqual(uniformDistribution(2, 5));
    expect(verifyBonus(drop, lesserFas, fas, bonus)).toEqual({ isVerified: true });
  });

  it('fails closed, naming the divergent value, when drop is not uniform', () => {
    const drop: ValueDistribution = { minValue: 5, probabilities: [0.7, 0.3] };
    const lesserFas = uniformDistribution(7, 9);
    const fas = uniformDistribution(9, 13);
    const bonus = uniformDistribution(2, 4);

    const result = verifyBonus(drop, lesserFas, fas, bonus);

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
    const bonus = deriveBonus(drop, lesserFas)!;
    // A fas distribution that does not match drop ⊛ bonus ⊛ bonus (which
    // is triangular, not flat).
    const wrongFas = uniformDistribution(9, 23);

    const result = verifyBonus(drop, lesserFas, wrongFas, bonus);

    expect(result.isVerified).toBe(false);
    if (result.isVerified) {
      throw new Error('expected verification to fail');
    }
    expect(result.reason).toMatch(/does not reproduce fas at value/);
  });
});

// ---------------------------------------------------------------------------
// Composition. Fixtures use RANK_1_5 / quality 3 / flat ATK throughout, whose
// published numbers Milestone 1 verified: drop 5-7, bonus 2-8, so
// lfas = 7-15 and fas = 9-23. See docs/stones.md for the mechanics.
// ---------------------------------------------------------------------------

const DROP_Q3_FLAT = uniformDistribution(5, 7);
const BONUS_Q3_FLAT = uniformDistribution(2, 8);
const LFAS_Q3_FLAT = convolve(DROP_Q3_FLAT, BONUS_Q3_FLAT);
const FAS_Q3_FLAT = convolve(LFAS_Q3_FLAT, BONUS_Q3_FLAT);

/** A 3★ Alteration/Refinement stone for a flat blessing: 3-5. */
function flatStone(stoneQuality: number): ValueDistribution {
  const range = getStoneValueRange('ATK', stoneQuality)!;
  return uniformDistribution(range.minValue, range.maxValue);
}

describe('composeSlotValue', () => {
  it('is exactly drop ⊛ bonus for an untouched, enhanced slot (Milestone 1 regression)', () => {
    // The existing behaviour must not shift now that a composition wrapper exists.
    const composed = composeSlotValue({
      base: DROP_Q3_FLAT,
      refine: null,
      bonus: BONUS_Q3_FLAT,
    });

    expect(composed).toEqual(convolve(DROP_Q3_FLAT, BONUS_Q3_FLAT));
    expect(valueRange(composed)).toEqual({ minValue: 7, maxValue: 15 });
  });

  it('returns the base alone when nothing else applies', () => {
    const composed = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });

    expect(valueRange(composed)).toEqual({ minValue: 5, maxValue: 7 });
  });

  it('altered before the checkpoint, then enhanced, is stone ⊛ bonus', () => {
    // 3★ stone 3-5, bonus 2-8 => 5-13.
    const composed = composeSlotValue({
      base: flatStone(3),
      refine: null,
      bonus: BONUS_Q3_FLAT,
    });

    expect(valueRange(composed)).toEqual({ minValue: 5, maxValue: 13 });
  });

  it('altered after the checkpoint is the stone alone — the bonus is forfeited', () => {
    const composed = composeSlotValue({ base: flatStone(3), refine: null, bonus: null });

    expect(valueRange(composed)).toEqual({ minValue: 3, maxValue: 5 });
  });

  it('refined and enhanced is drop ⊛ stone ⊛ bonus (refinement retained since 1.12.1)', () => {
    // drop 5-7, 3★ refine stone 3-5, bonus 2-8 => 10-20.
    const composed = composeSlotValue({
      base: DROP_Q3_FLAT,
      refine: flatStone(3),
      bonus: BONUS_Q3_FLAT,
    });

    expect(valueRange(composed)).toEqual({ minValue: 10, maxValue: 20 });
  });

  it('reproduces the worked Alteration comparison in docs/milestone-blessings.md', () => {
    // That doc's 3★ SILVER_OTHER slot-3 table: flat initial 5-8, bonus 2-10,
    // 3★ alteration stone 3-5.
    const silverOtherDrop = uniformDistribution(5, 8);
    const silverOtherBonus = uniformDistribution(2, 10);
    const stone = flatStone(3);

    const presentAtDropThenEnhanced = composeSlotValue({
      base: silverOtherDrop,
      refine: null,
      bonus: silverOtherBonus,
    });
    const alteredBeforeThenEnhanced = composeSlotValue({
      base: stone,
      refine: null,
      bonus: silverOtherBonus,
    });
    const milestoneFilled = composeSlotValue({ base: silverOtherDrop, refine: null, bonus: null });
    const alteredAfter = composeSlotValue({ base: stone, refine: null, bonus: null });

    expect(valueRange(presentAtDropThenEnhanced)).toEqual({ minValue: 7, maxValue: 18 });
    expect(valueRange(alteredBeforeThenEnhanced)).toEqual({ minValue: 5, maxValue: 15 });
    expect(valueRange(milestoneFilled)).toEqual({ minValue: 5, maxValue: 8 });
    expect(valueRange(alteredAfter)).toEqual({ minValue: 3, maxValue: 5 });
  });
});

describe('composeSlotValue — full alteration stones', () => {
  it('picks the base per slot, not per piece: a FAS at +20 leaves slots 1-2 above slots 3-4', () => {
    // The grade-3 (blue) axe: 2 slots occupied at drop, taken to +20, then FAS'd.
    // Slots 1-2 were entitled to a milestone bonus, and the stone's bonus
    // carries the same entitlement, so they take the `fas` table. Slots 3-4 were
    // merely milestone-FILLED: they earned no bonus and are bonused by
    // nothing, so a FAS returns them to plain `drop`. This is the case that
    // breaks if anyone "simplifies" the base choice into one per-piece band.
    const occupiedAtDrop = composeSlotValue({ base: FAS_Q3_FLAT, refine: null, bonus: null });
    const milestoneFilled = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });

    expect(valueRange(occupiedAtDrop)).toEqual({ minValue: 9, maxValue: 23 });
    expect(valueRange(milestoneFilled)).toEqual({ minValue: 5, maxValue: 7 });
    expect(valueRange(occupiedAtDrop).minValue).toBeGreaterThan(valueRange(milestoneFilled).minValue);
    expect(valueRange(occupiedAtDrop).maxValue).toBeGreaterThan(valueRange(milestoneFilled).maxValue);
  });

  it('a slot occupied at drop ends up identical whether the FAS lands before or after its checkpoint', () => {
    // A FAS grants its own bonus unconditionally and re-applies the milestone
    // bonus the slot had already earned. At +0 there is none earned yet, so the
    // stone writes drop + FAS bonus (the `lfas` band) and the milestone supplies
    // the second term later; at +20 it writes all three at once (the `fas`
    // table). Both are drop ⊛ bonus ⊛ bonus, which is the ceiling — a third term
    // is what the old "drop ⊛ bonus³ = 11-31 double-dip" reading got wrong.
    const fasEarlyThenEnhanced = composeSlotValue({
      base: LFAS_Q3_FLAT,
      refine: null,
      bonus: BONUS_Q3_FLAT,
    });
    const enhancedThenFas = composeSlotValue({ base: FAS_Q3_FLAT, refine: null, bonus: null });

    expect(valueRange(fasEarlyThenEnhanced)).toEqual({ minValue: 9, maxValue: 23 });
    expect(valueRange(fasEarlyThenEnhanced)).toEqual(valueRange(enhancedThenFas));
  });

  it('a LFAS is timing-independent too: all it restores is the milestone the slot would have earned anyway', () => {
    const lesserEarlyThenEnhanced = composeSlotValue({
      base: DROP_Q3_FLAT,
      refine: null,
      bonus: BONUS_Q3_FLAT,
    });
    const enhancedThenLesser = composeSlotValue({ base: LFAS_Q3_FLAT, refine: null, bonus: null });

    expect(valueRange(lesserEarlyThenEnhanced)).toEqual({ minValue: 7, maxValue: 15 });
    expect(valueRange(enhancedThenLesser)).toEqual(valueRange(lesserEarlyThenEnhanced));
  });

  it('a slot empty at drop is never bonused, so stone timing cannot move it', () => {
    // Before its milestone a stone passes over such a slot entirely — there is no
    // blessing there to re-roll — and the milestone then fills it at plain `drop`.
    // After its milestone the stone does re-roll it, but grants no bonus, since it
    // never held a blessing at drop. Plain `drop` in every combination.
    const stonedBeforeItFilled = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });
    const stonedAfterItFilled = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });

    expect(valueRange(stonedBeforeItFilled)).toEqual({ minValue: 5, maxValue: 7 });
    expect(valueRange(stonedAfterItFilled)).toEqual(valueRange(stonedBeforeItFilled));
  });

  it('a LFAS leaves every slot on the band it already had — occupied and milestone-filled alike', () => {
    // Observed, not assumed: a 4★ Steel Ring of the Warrior Princess that started
    // blue (2 blessings) and was taken to +20, then LFAS'd, came back with slots
    // 1-2 above the drop ceiling and slot 3 below the lfas floor. So a Lesser
    // stone restores an occupied slot's earned bonus and gives a
    // milestone-filled slot none — i.e. it re-rolls identities at unchanged value
    // odds. See docs/stones.md.
    const occupiedBefore = composeSlotValue({
      base: DROP_Q3_FLAT,
      refine: null,
      bonus: BONUS_Q3_FLAT,
    });
    const filledBefore = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });

    const occupiedAfterLesser = composeSlotValue({ base: LFAS_Q3_FLAT, refine: null, bonus: null });
    const filledAfterLesser = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });

    expect(valueRange(occupiedAfterLesser)).toEqual(valueRange(occupiedBefore));
    expect(valueRange(filledAfterLesser)).toEqual(valueRange(filledBefore));
  });

  it('reproduces the observed Ring of the Warrior Princess split (RANK_1_5, quality 4)', () => {
    // drop 8-10, bonus 3-10 => lfas 11-20 for a flat blessing. The recorded
    // values were ACC+12 and RES+17 on the two slots occupied at drop, and ATK+8
    // on a milestone-filled one. 12 and 17 are impossible without an bonus;
    // 8 is impossible with one. That contrast is the whole per-slot rule.
    const drop = uniformDistribution(8, 10);
    const bonus = uniformDistribution(3, 10);
    const lfas = convolve(drop, bonus);

    const occupied = valueRange(composeSlotValue({ base: lfas, refine: null, bonus: null }));
    const filled = valueRange(composeSlotValue({ base: drop, refine: null, bonus: null }));

    expect(occupied).toEqual({ minValue: 11, maxValue: 20 });
    expect(filled).toEqual({ minValue: 8, maxValue: 10 });

    for (const observed of [12, 17]) {
      expect(observed, `slot occupied at drop saw ${observed}`).toBeGreaterThan(filled.maxValue);
      expect(observed).toBeGreaterThanOrEqual(occupied.minValue);
    }
    expect(8, 'milestone-filled slot saw 8').toBeLessThan(occupied.minValue);
  });

  it('a FAS improves a slot occupied at drop by one bonus, and a milestone-filled slot not at all', () => {
    // The bonus is earned on the milestone's terms — occupied at drop or nothing —
    // so the two stones differ only where the piece's drop grade paid for a slot.
    // That is what makes a Full stone worth saving for high-grade gear
    // specifically, rather than for any good piece.
    const occupiedAfterLesser = composeSlotValue({ base: LFAS_Q3_FLAT, refine: null, bonus: null });
    const occupiedAfterFull = composeSlotValue({ base: FAS_Q3_FLAT, refine: null, bonus: null });
    const filledAfterLesser = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });
    const filledAfterFull = composeSlotValue({ base: DROP_Q3_FLAT, refine: null, bonus: null });

    expect(valueRange(occupiedAfterFull).minValue).toBeGreaterThan(valueRange(occupiedAfterLesser).minValue);
    expect(valueRange(filledAfterFull)).toEqual(valueRange(filledAfterLesser));
    // So the gap between a blue piece's slots 1-2 and its slots 3-4 is one
    // bonus before any stone and two after a FAS — it widens, never closes.
    expect(valueRange(occupiedAfterFull).minValue - valueRange(filledAfterFull).minValue)
      .toBeGreaterThan(valueRange(occupiedAfterLesser).minValue - valueRange(filledAfterLesser).minValue);
  });
});

describe('valueRange', () => {
  it('reports the inclusive support of a distribution', () => {
    expect(valueRange(uniformDistribution(3, 9))).toEqual({ minValue: 3, maxValue: 9 });
  });

  it('handles a single-point distribution', () => {
    expect(valueRange({ minValue: 4, probabilities: [1] })).toEqual({ minValue: 4, maxValue: 4 });
  });
});

describe('pointMass', () => {
  it('is a distribution with all its weight on one value', () => {
    expect(pointMass(12)).toEqual({ minValue: 12, probabilities: [1] });
    expect(valueRange(pointMass(12))).toEqual({ minValue: 12, maxValue: 12 });
  });
});

describe('probabilityAtLeast', () => {
  it('sums the tail at and above the threshold', () => {
    // 3-10 is eight values; 8, 9 and 10 clear a threshold of 8.
    expect(probabilityAtLeast(uniformDistribution(3, 10), 8)).toBeCloseTo(3 / 8, 12);
  });

  it('is 1 below the support and 0 above it', () => {
    expect(probabilityAtLeast(uniformDistribution(3, 10), 3)).toBeCloseTo(1, 12);
    expect(probabilityAtLeast(uniformDistribution(3, 10), 11)).toBe(0);
  });

  it('normalises first, so unnormalised weights still give a probability', () => {
    expect(probabilityAtLeast({ minValue: 1, probabilities: [2, 2] }, 2)).toBeCloseTo(0.5, 12);
  });
});

// ---------------------------------------------------------------------------
// enhancementOdds
//
// A deliberately small catalogue — five blessings, equal per-slot rates — so
// every expected number below is a fraction that can be checked by hand rather
// than by re-running the implementation. Value bands are the real published
// ones for RANK_1_5 quality 4 (docs/milestone-blessings.md).
// ---------------------------------------------------------------------------

const CATALOG = ['ATK', 'DEF', 'MAG', 'ACC', 'SUR'];

/** Every slot rolls the whole catalogue at equal odds. */
const EQUAL_SLOT_RATES: readonly ReadonlyMap<string, number>[] = Array.from(
  { length: MAX_BLESSING_SLOTS },
  () => new Map(CATALOG.map((code) => [code, 1 / CATALOG.length])),
);

/** RANK_1_5, quality 4: flat blessings drop at 8-10, SUR at 4-5. */
const DROP_BY_BLESSING = new Map<string, ValueDistribution>([
  ['ATK', uniformDistribution(8, 10)],
  ['DEF', uniformDistribution(8, 10)],
  ['MAG', uniformDistribution(8, 10)],
  ['ACC', uniformDistribution(8, 10)],
  ['SUR', uniformDistribution(4, 5)],
]);

/** RANK_1_5, quality 4: the derived milestone bonus — flat 3-10, SUR 1-3. */
const BONUS_BY_BLESSING = new Map<string, ValueDistribution>([
  ['ATK', uniformDistribution(3, 10)],
  ['DEF', uniformDistribution(3, 10)],
  ['MAG', uniformDistribution(3, 10)],
  ['ACC', uniformDistribution(3, 10)],
  ['SUR', uniformDistribution(1, 3)],
]);

/** A slot holding `blessingCode` at `value`, or an empty one when both are null. */
function slotState(
  slot: number,
  blessingCode: string | null,
  value: number | null,
  planRefineStoneQuality: number | null = null,
): EnhancementSlotInput {
  return { slot, blessingCode, value, planRefineStoneQuality };
}

/** The four slots of a piece whose occupied prefix is `occupied`. */
function piece(occupied: readonly (readonly [string, number])[]): EnhancementSlotInput[] {
  return Array.from({ length: MAX_BLESSING_SLOTS }, (_unused, index) => {
    const held = occupied[index];
    return held ? slotState(index + 1, held[0], held[1]) : slotState(index + 1, null, null);
  });
}

function oddsFor(overrides: Partial<EnhancementOddsInput>): EnhancementOddsResult {
  return enhancementOdds({
    enhancementLevel: 0,
    targetEnhancementLevel: 20,
    slots: piece([]),
    targets: [],
    alteredSlot: null,
    alteredFrom: null,
    slotBlessingRates: EQUAL_SLOT_RATES,
    dropByBlessing: DROP_BY_BLESSING,
    bonusByBlessing: BONUS_BY_BLESSING,
    ...overrides,
  });
}

describe('enhancementOdds', () => {
  it("reproduces docs/milestone-blessings.md's worked example exactly", () => {
    // A 4* RANK_1_5 piece at +0 with flat ATK at 8 on slot 1, wanting ATK >= 16.
    // Slot 1's +5 milestone adds a bonus uniform over 3-10, so reaching 16 needs
    // 8, 9 or 10 -> 3/8. The three empty slots cannot perturb it: ATK is already
    // on the piece, and the draw chain never repeats a blessing.
    const result = oddsFor({
      slots: piece([['ATK', 8]]),
      targets: [{ blessingCode: 'ATK', minValue: 16 }],
    });

    expect(result.probability).toBeCloseTo(0.375, 12);
    expect(result.remainingMilestones).toEqual([5, 10, 15, 20]);
  });

  it('gives an occupied slot with its milestone still ahead the bonus, and one past it nothing', () => {
    const stillToCome = oddsFor({ slots: piece([['ATK', 8]]), enhancementLevel: 0 });
    const alreadyDone = oddsFor({ slots: piece([['ATK', 8]]), enhancementLevel: 5 });

    // 8 + Uniform(3, 10) = 11-18, versus a value that is already final.
    expect(valueRange(stillToCome.slots[0]?.valueDistribution ?? pointMass(0)))
      .toEqual({ minValue: 11, maxValue: 18 });
    expect(stillToCome.slots[0]?.isFinal).toBe(false);

    expect(valueRange(alreadyDone.slots[0]?.valueDistribution ?? pointMass(0)))
      .toEqual({ minValue: 8, maxValue: 8 });
    expect(alreadyDone.slots[0]?.isFinal).toBe(true);
  });

  it('fills an empty slot from the plain drop band with no bonus on top', () => {
    const result = oddsFor({ targets: [{ blessingCode: 'DEF', minValue: null }] });

    // A White piece at +0: every slot is filled by a milestone, and a filled
    // slot collects an initial roll and nothing more (docs/milestone-blessings.md).
    const candidate = result.slots[0]?.candidates?.find((entry) => entry.blessingCode === 'DEF');
    expect(valueRange(candidate?.valueDistribution ?? pointMass(0)))
      .toEqual({ minValue: 8, maxValue: 10 });
  });

  it('draws the empty slots without replacement across the whole piece', () => {
    // Four slots drawn from five equally-likely blessings: exactly one blessing
    // is left out, so any given one appears with probability 4/5.
    const result = oddsFor({ targets: [{ blessingCode: 'DEF', minValue: null }] });

    expect(result.probability).toBeCloseTo(4 / 5, 12);
  });

  it('renormalises a filled slot to exclude what the piece already carries', () => {
    // Slot 1 holds ATK, so slots 2-4 share the other four blessings between
    // them: three of the four appear, and each does so with probability 3/4.
    const result = oddsFor({
      slots: piece([['ATK', 8]]),
      targets: [{ blessingCode: 'DEF', minValue: null }],
    });

    expect(result.probability).toBeCloseTo(3 / 4, 12);
  });

  it('cannot reach a blessing already fixed below its target, since no other slot can roll it', () => {
    // ATK is final at 8 and the no-stack rule keeps it out of every other slot,
    // so wanting ATK >= 16 on this piece is flatly impossible.
    const result = oddsFor({
      slots: piece([['ATK', 8]]),
      enhancementLevel: 5,
      targets: [{ blessingCode: 'ATK', minValue: 16 }],
    });

    expect(result.probability).toBe(0);
  });

  it('stops at targetEnhancementLevel, leaving the later slots untouched', () => {
    const result = oddsFor({ targetEnhancementLevel: 10 });

    expect(result.remainingMilestones).toEqual([5, 10]);
    expect(result.slots[1]?.candidates).not.toBeNull();
    // Slots 3 and 4 are never reached, so they stay empty and final.
    expect(result.slots[2]?.candidates).toBeNull();
    expect(result.slots[2]?.isFinal).toBe(true);
    expect(result.slots[3]?.blessingCode).toBeNull();
  });

  it('reports which blessings it lacked data for instead of quietly scoring them zero', () => {
    const result = oddsFor({
      slots: piece([['ATK', 8]]),
      bonusByBlessing: new Map(),
      targets: [{ blessingCode: 'ATK', minValue: 16 }],
    });

    expect(result.missingBlessingData).toContain('ATK');
  });

  // -------------------------------------------------------------------------
  // Alteration. The identity chain runs on what each slot ORIGINALLY rolled, so
  // an altered slot can be duplicated by a later milestone — see finding 2 in
  // the milestone plan and docs/milestone-blessings.md.
  // -------------------------------------------------------------------------

  describe('an altered slot', () => {
    /** Blue at drop (slots 1-2), at +10, wanting two ATK — one good, one anything. */
    const twoAtk = [
      { blessingCode: 'ATK', minValue: 12 },
      { blessingCode: 'ATK', minValue: 8 },
    ];
    const blueAtPlusTen = {
      slots: piece([['ATK', 12], ['SUR', 6]]),
      enhancementLevel: 10,
      targets: twoAtk,
    };

    it('lets a later milestone roll the blessing the stone put there', () => {
      // Slot 1 was ACC at drop and was altered to ATK, so the chain still avoids
      // ACC rather than ATK: slots 3 and 4 share {ATK, DEF, MAG}, and two slots
      // out of three carry ATK with probability 2/3.
      const result = oddsFor({ ...blueAtPlusTen, alteredSlot: 1, alteredFrom: 'ACC' });

      expect(result.probability).toBeCloseTo(2 / 3, 12);
    });

    it('is what separates a possible second ATK from an impossible one', () => {
      // The very same piece, not declared as altered: the chain then treats slot
      // 1's ATK as its original roll, no other slot can repeat it, and a second
      // ATK becomes flatly impossible. This pair is the regression test — if the
      // exclusion set is ever "simplified" back to the displayed blessings, the
      // number above silently collapses to this one.
      const result = oddsFor(blueAtPlusTen);

      expect(result.probability).toBe(0);
    });

    it('averages over what the slot might have been when the player cannot say', () => {
      const marginalised = oddsFor({ ...blueAtPlusTen, alteredSlot: 1, alteredFrom: null });

      // Slot 2 is pinned to SUR, so the original of slot 1 is uniform over the
      // four remaining blessings — and the answer must be their plain mean.
      const perOrigin = CATALOG
        .filter((code) => code !== 'SUR')
        .map((code) => oddsFor({ ...blueAtPlusTen, alteredSlot: 1, alteredFrom: code }).probability);
      const mean = perOrigin.reduce((sum, value) => sum + value, 0) / perOrigin.length;

      expect(marginalised.probability).toBeCloseTo(mean, 12);
      // An original of ATK makes a second ATK impossible; the other three give
      // 2/3 each, so the average lands exactly on a half.
      expect(marginalised.probability).toBeCloseTo(0.5, 12);
    });

    it('needs two distinct slots for two targets on one blessing, not one counted twice', () => {
      // Slot 1's ATK is 12, which clears both thresholds on its own — but two
      // targets still need two slots, so this is not a certainty.
      const result = oddsFor({ ...blueAtPlusTen, alteredSlot: 1, alteredFrom: 'ACC' });

      expect(result.probability).toBeLessThan(1);
    });
  });

  // -------------------------------------------------------------------------
  // Planned refinement — the one action v1 lets a player try out.
  // -------------------------------------------------------------------------

  describe('a planned refinement', () => {
    it('convolves the stone band onto a slot that has finished enhancing', () => {
      const result = oddsFor({
        slots: [
          slotState(1, 'ATK', 12, 3), // a *3 stone: flat blessings gain 3-5
          slotState(2, null, null),
          slotState(3, null, null),
          slotState(4, null, null),
        ],
        enhancementLevel: 5,
      });

      expect(valueRange(result.slots[0]?.valueDistribution ?? pointMass(0)))
        .toEqual({ minValue: 15, maxValue: 17 });
      expect(result.slots[0]?.isFinal).toBe(false); // a stone is still to be spent
    });

    it('stacks with a milestone bonus that has yet to land', () => {
      const result = oddsFor({
        slots: [
          slotState(1, 'ATK', 12, 3),
          slotState(2, null, null),
          slotState(3, null, null),
          slotState(4, null, null),
        ],
        enhancementLevel: 0,
      });

      // 12 + bonus 3-10 + stone 3-5 = 18-27.
      expect(valueRange(result.slots[0]?.valueDistribution ?? pointMass(0)))
        .toEqual({ minValue: 18, maxValue: 27 });
    });
  });
});
