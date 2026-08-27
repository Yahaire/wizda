/**
 * Enhancement math — the pure, Prisma-free core of "what value does a
 * blessing end up at after enhancing?".
 *
 * Derivation, rationale, and the milestone model are documented in
 * `docs/milestone-blessings.md`; the stone mechanics {@link composeSlotValue}
 * models are in `docs/stones.md`. Keep this module free of DB/HTTP concerns so
 * it stays trivially unit-testable (see `enhancementMath.test.ts`).
 *
 * Notation: `⊛` is convolution — `A ⊛ B` is the distribution of `a + b` with
 * `a` and `b` drawn independently. That is exactly what {@link convolve} does.
 */

import { forEachSlotAssignment, MAX_BLESSING_SLOTS, milestoneForSlot } from './blessingSlots';
import { getStoneValueRange } from './stoneValues';

/**
 * A probability distribution over a run of consecutive integer values.
 * `probabilities[i]` is P(minValue + i). Not assumed normalised — see
 * {@link normalizeDistribution}.
 */
export interface ValueDistribution {
  minValue: number,
  probabilities: readonly number[],
}

/**
 * Tolerance for comparing two distributions that are expected to represent the
 * *same* underlying values — either "is this uniform?" or "does a reconvolved
 * distribution reproduce a published one?". The source publishes percentages
 * to 4 decimal places, so a single cell can be off by ~1e-6, and `fas`
 * (`drop ⊛ bonus ⊛ bonus`, a double convolution) compounds that to
 * ~6e-7 per cell — observed against the live page, worst case across 380
 * (group, quality, blessing) rows. `SUM_TOLERANCE` (0.005, `rateParsing.ts`)
 * allows for a distribution's own rounding when summing to ~100% and is far
 * too loose for a per-cell check; `1e-9` is too tight and fails on every real
 * row. `1e-5` is a ~15x margin over the observed residual and still 500x
 * tighter than `SUM_TOLERANCE`.
 */
const RECONVOLUTION_TOLERANCE = 1e-5;

function maxValue(dist: ValueDistribution): number {
  return dist.minValue + dist.probabilities.length - 1;
}

function probabilityAt(dist: ValueDistribution, value: number): number {
  return dist.probabilities[value - dist.minValue] ?? 0;
}

/** Rescales `probabilities` to sum to 1. A distribution summing to 0 is returned unchanged. */
export function normalizeDistribution(dist: ValueDistribution): ValueDistribution {
  const total = dist.probabilities.reduce((sum, p) => sum + p, 0);
  if (total === 0) {
    return dist;
  }
  return {
    minValue: dist.minValue,
    probabilities: dist.probabilities.map((p) => p / total),
  };
}

/**
 * The distribution of the sum of two independent random values, one drawn
 * from each input. Both inputs are normalised first, so the result always
 * sums to 1 regardless of the inputs' own totals.
 */
export function convolve(a: ValueDistribution, b: ValueDistribution): ValueDistribution {
  const normA = normalizeDistribution(a);
  const normB = normalizeDistribution(b);

  const minValue = normA.minValue + normB.minValue;
  const probabilities = new Array<number>(normA.probabilities.length + normB.probabilities.length - 1).fill(0);

  normA.probabilities.forEach((pa, i) => {
    normB.probabilities.forEach((pb, j) => {
      probabilities[i + j] = (probabilities[i + j] ?? 0) + pa * pb;
    });
  });

  return { minValue, probabilities };
}

/** Whether `dist`, once normalised, assigns (near-)equal probability to every value in its range. */
export function isUniform(dist: ValueDistribution): boolean {
  const { probabilities } = normalizeDistribution(dist);
  if (probabilities.length === 0) {
    return false;
  }
  const expected = 1 / probabilities.length;
  return probabilities.every((p) => Math.abs(p - expected) <= RECONVOLUTION_TOLERANCE);
}

/** A uniform distribution over the inclusive integer range [minValue, maxValueInclusive]. */
export function uniformDistribution(minValue: number, maxValueInclusive: number): ValueDistribution {
  const length = maxValueInclusive - minValue + 1;
  return {
    minValue,
    probabilities: new Array<number>(length).fill(1 / length),
  };
}

interface DistributionMismatch {
  value: number,
  expectedProbability: number,
  actualProbability: number,
}

/**
 * The first value (ascending) where `actual` diverges from `expected` by more
 * than {@link RECONVOLUTION_TOLERANCE}, or `null` if none does. Both are
 * normalised first.
 */
function findFirstMismatch(expected: ValueDistribution, actual: ValueDistribution): DistributionMismatch | null {
  const normExpected = normalizeDistribution(expected);
  const normActual = normalizeDistribution(actual);
  const lo = Math.min(normExpected.minValue, normActual.minValue);
  const hi = Math.max(maxValue(normExpected), maxValue(normActual));

  for (let value = lo; value <= hi; value++) {
    const expectedProbability = probabilityAt(normExpected, value);
    const actualProbability = probabilityAt(normActual, value);
    if (Math.abs(expectedProbability - actualProbability) > RECONVOLUTION_TOLERANCE) {
      return { value, expectedProbability, actualProbability };
    }
  }
  return null;
}

/**
 * Recovers the **bonus** from the supports of two published distributions:
 * `lesserFas = drop ⊛ bonus`, and every `drop` distribution is uniform, so
 * `bonus`'s support is exactly
 * `[lesserFas.min − drop.min, lesserFas.max − drop.max]` (see
 * docs/milestone-blessings.md, "Deriving the bonus"). Assumes the bonus itself
 * is uniform — true for every group checked so far; {@link verifyBonus} is what
 * proves that for a given row rather than just asserting it.
 *
 * One distribution, two roles: a **milestone bonus** is what enhancing to +5n
 * grants a slot that held a blessing at drop, and a **FAS bonus** is what a Full
 * Alteration Stone grants. They are independent draws from this same range,
 * which is why `fas = drop ⊛ bonus ⊛ bonus`.
 *
 * Edge cases: returns `null` if the derived range is empty (`lesserFas`
 * narrower than `drop`) — a pair that cannot describe an added bonus.
 */
export function deriveBonus(
  drop: ValueDistribution,
  lesserFas: ValueDistribution,
): ValueDistribution | null {
  const lo = lesserFas.minValue - drop.minValue;
  const hi = maxValue(lesserFas) - maxValue(drop);
  if (hi < lo) {
    return null;
  }
  return uniformDistribution(lo, hi);
}

/**
 * The independent terms that add up to one slot's **final** value, once every
 * remaining enhancement milestone has been applied. Convolving whichever terms
 * are present gives the slot's value distribution — see {@link composeSlotValue}.
 *
 * Two rules decide what goes in here, and both are subtle enough that callers
 * should not reproduce them inline (see `docs/stones.md`):
 *
 * **Which `base`** — whatever roll last set the slot:
 * - never altered, never stone-rerolled ⇒ the `drop` distribution
 * - altered ⇒ the Alteration Stone's uniform range
 * - LFAS/FAS ⇒ chosen **per slot, not per piece**. A stone re-rolls the slot's
 *   base and re-applies whatever that slot has already *earned*: the milestone
 *   bonus, if the piece had passed that slot's milestone when the stone landed.
 *   A Full stone additionally grants its own FAS bonus, always. So for a slot
 *   occupied at drop: `lfas` under a Lesser stone and `fas` under a Full one if
 *   the milestone had been reached, else `drop` and `lfas` respectively, with
 *   `bonus` below supplying the milestone when it arrives.
 * - A slot **empty at drop** never collects either term. Before its milestone a
 *   stone passes over it entirely — there is no blessing there to re-roll; after
 *   it, the stone re-rolls it onto plain `drop`. Both give `drop`, so it takes
 *   that base in every combination.
 *
 * **Whether `bonus` is present** — iff the slot is entitled to one *and* its
 * milestone checkpoint falls *after* whatever event set its base:
 * - a slot empty at drop ⇒ never: its milestone *fills* the slot rather than
 *   boosting it (see `docs/milestone-blessings.md`)
 * - a `drop` base on a slot occupied at drop ⇒ always present (the checkpoint is
 *   always later)
 * - altered *before* its checkpoint ⇒ present; altered *after* ⇒ absent, and
 *   permanently so: that slot is never enhanced again
 * - LFAS/FAS on a slot occupied at drop ⇒ present iff the piece had not yet
 *   reached that checkpoint when the stone was used; if it had, the stone's own
 *   table already includes that milestone bonus and adding one here would count
 *   it twice
 *
 * The two orders therefore agree: an occupied slot ends on `drop ⊛ bonus` under
 * a Lesser stone and `drop ⊛ bonus ⊛ bonus` under a Full one whether the stone
 * was used before or after that slot's milestone. Two bonuses is the ceiling —
 * there is no third.
 */
export interface SlotValueComposition {
  /** The roll that last set this slot: drop, an alteration stone, or a LFAS/FAS re-roll. */
  base: ValueDistribution,
  /** The refinement stone's roll, or null if the slot is unrefined. */
  refine: ValueDistribution | null,
  /** The milestone bonus, or null if this slot will never receive one. */
  bonus: ValueDistribution | null,
}

/**
 * A slot's final value distribution: `base ⊛ refine ⊛ bonus`, skipping
 * whichever terms are absent. The terms are independent rolls, so this is a
 * plain convolution chain — see {@link SlotValueComposition} for how a caller
 * decides what to put in each field.
 *
 * Edge cases: with `refine` and `bonus` both null this is just `base`
 * (normalised).
 */
export function composeSlotValue(composition: SlotValueComposition): ValueDistribution {
  const terms = [composition.base, composition.refine, composition.bonus]
    .filter((term): term is ValueDistribution => term !== null);

  return terms.reduce((total, term) => convolve(total, term));
}

/**
 * The inclusive range of values a distribution can produce — what the UI needs
 * to constrain a value input, and to label which band a player's own number
 * falls into.
 */
export function valueRange(dist: ValueDistribution): { minValue: number, maxValue: number } {
  return { minValue: dist.minValue, maxValue: maxValue(dist) };
}

/** A value already known exactly — a slot whose rolling is finished. */
export function pointMass(value: number): ValueDistribution {
  return { minValue: value, probabilities: [1] };
}

/**
 * P(value ≥ `minValue`) for a distribution, normalising first. Exported because
 * the web client re-slices a returned distribution locally when the player drags
 * a target threshold, rather than making a round trip for each step.
 */
export function probabilityAtLeast(dist: ValueDistribution, minValue: number): number {
  const normalized = normalizeDistribution(dist);
  let total = 0;
  normalized.probabilities.forEach((probability, index) => {
    if (normalized.minValue + index >= minValue) {
      total += probability;
    }
  });
  return total;
}

export type VerifyBonusResult =
  | { isVerified: true }
  | { isVerified: false, reason: string };

/**
 * Proves a derived bonus by reconvolution: checks that `drop` is itself
 * uniform, that `drop ⊛ bonus` reproduces `lesserFas`, and that
 * `drop ⊛ bonus ⊛ bonus` reproduces `fas` — the two independent
 * confirmations `docs/milestone-blessings.md` describes ("380/380" for each,
 * across all four value groups). Fails closed (returns `isVerified: false`
 * with a `reason` naming the first divergence, never throws) the moment any
 * check doesn't hold, the way `alignLocalizedNames.ts` fails closed on name
 * alignment.
 */
export function verifyBonus(
  drop: ValueDistribution,
  lesserFas: ValueDistribution,
  fas: ValueDistribution,
  bonus: ValueDistribution,
): VerifyBonusResult {
  if (!isUniform(drop)) {
    return { isVerified: false, reason: 'the drop distribution is not uniform' };
  }

  const reconvolvedLesserFas = convolve(drop, bonus);
  const lesserFasMismatch = findFirstMismatch(lesserFas, reconvolvedLesserFas);
  if (lesserFasMismatch) {
    return {
      isVerified: false,
      reason: 'drop ⊛ bonus does not reproduce lesserFas at value '
        + `${lesserFasMismatch.value} (expected ${(lesserFasMismatch.expectedProbability * 100).toFixed(4)}%, `
        + `got ${(lesserFasMismatch.actualProbability * 100).toFixed(4)}%)`,
    };
  }

  const reconvolvedFas = convolve(reconvolvedLesserFas, bonus);
  const fasMismatch = findFirstMismatch(fas, reconvolvedFas);
  if (fasMismatch) {
    return {
      isVerified: false,
      reason: 'drop ⊛ bonus ⊛ bonus does not reproduce fas at value '
        + `${fasMismatch.value} (expected ${(fasMismatch.expectedProbability * 100).toFixed(4)}%, `
        + `got ${(fasMismatch.actualProbability * 100).toFixed(4)}%)`,
    };
  }

  return { isVerified: true };
}

// ---------------------------------------------------------------------------
// The Enhancement Oracle calculation: "if I enhance this piece, what are the
// odds the blessings I care about end up at the numbers I want?"
//
// Two rules do all the work, and both are argued in docs/stones.md and
// docs/milestone-blessings.md rather than here:
//
//   1. A slot gains a future milestone bonus iff it is occupied *now* and
//      `5 * slot` is still ahead. Nothing else about its history matters — the
//      number on the item screen already contains the base roll, any
//      refinement, and any bonus it has already collected.
//   2. A slot a milestone *fills* takes a plain `drop` value and no bonus.
//
// The remaining subtlety is which blessing a milestone drops into an empty
// slot. Blessings are drawn without replacement (`blessingSlots.ts`), against
// the piece's *initial* blessings — what it dropped with, or what a Lesser/Full
// Alteration Stone last re-rolled it into, since those replace the natural set
// wholesale. A **standard** Alteration Stone is the exception: it overwrites
// what a slot displays without joining that set, and without removing the
// blessing it replaced from it. So the altered slot's original still blocks a
// later milestone while the stone's own blessing does not — which is why a
// piece can end up carrying the same blessing twice.
// ---------------------------------------------------------------------------

/** One slot as the item screen currently shows it. */
export interface EnhancementSlotInput {
  /** 1–{@link MAX_BLESSING_SLOTS}. */
  slot: number,
  /** The blessing in the slot, or null when the slot is still empty. */
  blessingCode: string | null,
  /** The number displayed, or null when the slot is empty. */
  value: number | null,
  /** ★1–5 of a Refinement Stone the player is considering for this slot, or null. */
  planRefineStoneQuality: number | null,
}

/** One thing the player wants to end up with. Targets are ANDed. */
export interface EnhancementTargetInput {
  blessingCode: string,
  /** Inclusive floor, or null for "any value — I just want this blessing". */
  minValue: number | null,
}

export interface EnhancementOddsInput {
  /** Where the piece is now, 0–{@link MAX_ENHANCEMENT_LEVEL}. */
  enhancementLevel: number,
  /** How far the player intends to take it, at least `enhancementLevel`. */
  targetEnhancementLevel: number,
  /** All {@link MAX_BLESSING_SLOTS} slots, in order. */
  slots: readonly EnhancementSlotInput[],
  targets: readonly EnhancementTargetInput[],
  /**
   * The one slot whose blessing was swapped by an Alteration Stone, or null.
   * At most one slot on a piece is ever in the altered state — every stone that
   * grants a fresh alteration first wipes the previous one (docs/stones.md).
   */
  alteredSlot: number | null,
  /**
   * What that slot originally rolled, if the player remembers. The identity
   * chain runs on originals, so this is the blessing later milestones avoid —
   * *not* the one the slot displays. Null marginalises over it.
   */
  alteredFrom: string | null,
  /** P(blessing | slot) from `EquipmentBlessingDropRate`; index 0 is slot 1. */
  slotBlessingRates: readonly ReadonlyMap<string, number>[],
  /** The `DROP` value distribution per blessing, at this piece's value group and quality. */
  dropByBlessing: ReadonlyMap<string, ValueDistribution>,
  /** The derived milestone bonus per blessing, at this piece's value group and quality. */
  bonusByBlessing: ReadonlyMap<string, ValueDistribution>,
}

/** One blessing a milestone could drop into an empty slot, and what it'd be worth. */
export interface EnhancementSlotCandidate {
  blessingCode: string,
  /** P(this blessing lands here), already conditioned on the rest of the piece. */
  probability: number,
  valueDistribution: ValueDistribution,
}

export interface EnhancementSlotOutcome {
  slot: number,
  /** True when nothing further will be rolled into this slot. */
  isFinal: boolean,
  /** The blessing the slot holds, or null when a milestone has yet to fill it. */
  blessingCode: string | null,
  /** The slot's final value distribution; a point mass when {@link isFinal}. */
  valueDistribution: ValueDistribution | null,
  /** What a milestone might put here, best-odds first; null unless the slot is being filled. */
  candidates: readonly EnhancementSlotCandidate[] | null,
}

export interface EnhancementOddsResult {
  /** P(every target met). */
  probability: number,
  /** The milestones between `enhancementLevel` and `targetEnhancementLevel`, ascending. */
  remainingMilestones: readonly number[],
  slots: readonly EnhancementSlotOutcome[],
  /**
   * Blessing codes the calculation needed a `drop` or bonus distribution for and
   * didn't have. Non-empty means {@link probability} rests on incomplete data and
   * the caller should report "no data" rather than the number — see the
   * degradation ladder in docs/domain.md.
   */
  missingBlessingData: readonly string[],
}

/** Never prune the walk: the per-slot marginals need every assignment, not just the covering ones. */
const VISIT_EVERY_ASSIGNMENT: ReadonlySet<string> = new Set<string>();

/** A Refinement Stone's uniform range for this blessing, or null if it isn't being refined. */
function refinementDistribution(
  blessingCode: string,
  stoneQuality: number | null,
): ValueDistribution | null {
  if (stoneQuality === null) {
    return null;
  }
  const range = getStoneValueRange(blessingCode, stoneQuality);
  return range ? uniformDistribution(range.minValue, range.maxValue) : null;
}

/**
 * P(these slots meet every threshold, each by a **distinct** slot). Distinct
 * because one blessing occupies one slot: asking for "ATK ≥ 16 and another
 * ATK ≥ 8" needs two ATK slots, not one good one counted twice.
 *
 * The single-threshold case is the plain union. Beyond that it's a bipartite
 * matching, and by Hall's theorem one exists exactly when, for every `j`, at
 * least `k − j + 1` slots clear the `j`-th smallest threshold. So each slot is
 * reduced to its *level* (how many thresholds its value clears) and the level
 * combinations are enumerated — at most 5⁴, and reachable at all only when an
 * altered slot has put a duplicate blessing on the piece, since the draw chain
 * itself never repeats one.
 */
function matchingProbability(
  distributions: readonly ValueDistribution[],
  thresholds: readonly number[],
): number {
  if (thresholds.length > distributions.length) {
    return 0; // too few slots carry this blessing to satisfy every target on it
  }
  if (thresholds.length === 0) {
    return 1;
  }

  const atLeast = (dist: ValueDistribution, threshold: number): number => (
    threshold === Number.NEGATIVE_INFINITY ? 1 : probabilityAtLeast(dist, threshold)
  );

  if (thresholds.length === 1) {
    const only = thresholds[0] ?? Number.NEGATIVE_INFINITY;
    const noneClear = distributions.reduce(
      (product, dist) => product * (1 - atLeast(dist, only)),
      1,
    );
    return 1 - noneClear;
  }

  const ascending = [...thresholds].sort((left, right) => left - right);
  const levelCount = ascending.length + 1; // a slot clears 0..k of them

  const levelProbabilities = distributions.map((dist) => {
    const clears = ascending.map((threshold) => atLeast(dist, threshold));
    return Array.from({ length: levelCount }, (_unused, level) => (
      (level === 0 ? 1 : (clears[level - 1] ?? 0)) - (clears[level] ?? 0)
    ));
  });

  let total = 0;
  const levels = new Array<number>(distributions.length).fill(0);

  const isFeasible = (): boolean => {
    // Hall's condition: the `k − j` thresholds from index `j` upward each need a
    // slot of level ≥ j + 1, so count the slots that reach each level.
    for (let j = 0; j < ascending.length; j++) {
      const needed = ascending.length - j;
      const available = levels.filter((level) => level >= j + 1).length;
      if (available < needed) {
        return false;
      }
    }
    return true;
  };

  const walk = (slotIndex: number, chained: number): void => {
    if (chained === 0) {
      return;
    }
    if (slotIndex === distributions.length) {
      if (isFeasible()) {
        total += chained;
      }
      return;
    }
    const perLevel = levelProbabilities[slotIndex] ?? [];
    for (let level = 0; level < levelCount; level++) {
      levels[slotIndex] = level;
      walk(slotIndex + 1, chained * (perLevel[level] ?? 0));
    }
    levels[slotIndex] = 0;
  };
  walk(0, 1);

  return total;
}

/**
 * The odds that enhancing this piece to `targetEnhancementLevel` meets every
 * target, plus what each slot will be worth.
 *
 * Slots the player reported are **pinned** in the identity chain and slots a
 * milestone will fill are free, so the walk enumerates the free ones while
 * holding the rest fixed. Pinned slots keep their real chain factor rather than
 * 1 — a free slot earlier in the chain can consume a blessing a later pinned
 * slot reports, and those histories are impossible given what was observed — so
 * the answer is `hit / total`, plain conditioning on the observation.
 *
 * Edge cases: a piece with nothing left to roll returns a probability of 0 or 1
 * and four final slots; a missing `drop`/bonus distribution is reported in
 * {@link EnhancementOddsResult.missingBlessingData} rather than throwing or
 * being silently treated as zero.
 */
export function enhancementOdds(input: EnhancementOddsInput): EnhancementOddsResult {
  const {
    enhancementLevel,
    targetEnhancementLevel,
    slots,
    targets,
    alteredSlot,
    alteredFrom,
    slotBlessingRates,
    dropByBlessing,
    bonusByBlessing,
  } = input;

  const missingBlessingData = new Set<string>();
  const isMilestoneRemaining = (slot: number): boolean => {
    const milestone = milestoneForSlot(slot);
    return enhancementLevel < milestone && milestone <= targetEnhancementLevel;
  };

  const remainingMilestones: number[] = [];
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    if (isMilestoneRemaining(slot)) {
      remainingMilestones.push(milestoneForSlot(slot));
    }
  }

  /** One slot resolved: what it shows, what it will be worth, whether a milestone fills it. */
  interface SlotPlan {
    slot: number,
    /** What the slot displays — an altered slot shows the stone's blessing, not its original. */
    displayBlessing: string | null,
    /** Set for an occupied slot; assignment-independent, since its value is already on screen. */
    occupiedValue: ValueDistribution | null,
    willBeFilled: boolean,
    isFinal: boolean,
    planRefineStoneQuality: number | null,
  }

  const plans: SlotPlan[] = [];
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    const state = slots.find((candidate) => candidate.slot === slot);
    const blessingCode = state?.blessingCode ?? null;
    const planRefineStoneQuality = state?.planRefineStoneQuality ?? null;

    if (blessingCode === null) {
      const willBeFilled = isMilestoneRemaining(slot);
      plans.push({
        slot,
        displayBlessing: null,
        occupiedValue: null,
        willBeFilled,
        isFinal: !willBeFilled,
        planRefineStoneQuality,
      });
      continue;
    }

    // Occupied: the displayed number already carries the base roll, any
    // refinement, and any bonus this slot has collected. Only a milestone still
    // ahead — and a refinement the player is planning — can add to it.
    const gainsBonus = isMilestoneRemaining(slot);
    const bonus = gainsBonus ? (bonusByBlessing.get(blessingCode) ?? null) : null;
    if (gainsBonus && !bonus) {
      missingBlessingData.add(blessingCode);
    }
    const refine = refinementDistribution(blessingCode, planRefineStoneQuality);
    plans.push({
      slot,
      displayBlessing: blessingCode,
      occupiedValue: composeSlotValue({
        base: pointMass(state?.value ?? 0),
        refine,
        bonus,
      }),
      willBeFilled: false,
      isFinal: !gainsBonus && refine === null,
      planRefineStoneQuality,
    });
  }

  // Only slots that hold a blessing or are about to receive one take part in the
  // draw. Both sets are prefixes (slots fill top-to-bottom), so this is one too.
  let activeSlotCount = 0;
  plans.forEach((plan, index) => {
    if (plan.displayBlessing !== null || plan.willBeFilled) {
      activeSlotCount = index + 1;
    }
  });

  // A milestone-filled slot draws a plain `drop` value and no bonus, so each
  // candidate's worth depends only on which blessing lands — precompute it per
  // slot rather than inside the walk.
  const filledValuesBySlot = new Map<number, Map<string, ValueDistribution>>();
  for (const plan of plans) {
    if (!plan.willBeFilled) {
      continue;
    }
    const byBlessing = new Map<string, ValueDistribution>();
    for (const blessingCode of slotBlessingRates[plan.slot - 1]?.keys() ?? []) {
      const drop = dropByBlessing.get(blessingCode);
      if (!drop) {
        missingBlessingData.add(blessingCode);
        continue;
      }
      byBlessing.set(blessingCode, composeSlotValue({
        base: drop,
        refine: refinementDistribution(blessingCode, plan.planRefineStoneQuality),
        bonus: null, // a slot its milestone *fills* is never also bonused
      }));
    }
    filledValuesBySlot.set(plan.slot, byBlessing);
  }

  const pinned: (string | null)[] = plans.slice(0, activeSlotCount).map((plan) => {
    if (plan.displayBlessing === null) {
      return null; // a milestone will fill it — that's what we're enumerating
    }
    // The chain runs on originals, so an altered slot pins to what it *was*, and
    // is left free to be marginalised when the player doesn't remember.
    return plan.slot === alteredSlot ? alteredFrom : plan.displayBlessing;
  });

  const targetsByBlessing = new Map<string, number[]>();
  for (const target of targets) {
    const thresholds = targetsByBlessing.get(target.blessingCode) ?? [];
    thresholds.push(target.minValue ?? Number.NEGATIVE_INFINITY);
    targetsByBlessing.set(target.blessingCode, thresholds);
  }

  const marginalsBySlot = new Map<number, Map<string, number>>();
  for (const plan of plans) {
    if (plan.willBeFilled) {
      marginalsBySlot.set(plan.slot, new Map<string, number>());
    }
  }

  // Memoised across assignments: a group's odds depend only on which slots hold
  // its blessing, and a slot's value distribution is fixed once its blessing is.
  const groupOddsCache = new Map<string, number>();

  const targetsProbability = (assignment: readonly string[]): number => {
    let joint = 1;
    for (const [blessingCode, thresholds] of targetsByBlessing) {
      const holdingSlots: number[] = [];
      for (let index = 0; index < activeSlotCount; index++) {
        const plan = plans[index];
        if (!plan) {
          continue;
        }
        const displayed = plan.willBeFilled ? (assignment[index] ?? null) : plan.displayBlessing;
        if (displayed === blessingCode) {
          holdingSlots.push(plan.slot);
        }
      }
      if (holdingSlots.length < thresholds.length) {
        return 0; // this assignment can't carry that many of this blessing
      }

      const cacheKey = `${blessingCode}|${holdingSlots.join(',')}`;
      let groupOdds = groupOddsCache.get(cacheKey);
      if (groupOdds === undefined) {
        const distributions: ValueDistribution[] = [];
        for (const slot of holdingSlots) {
          const plan = plans[slot - 1];
          const dist = plan?.willBeFilled
            ? filledValuesBySlot.get(slot)?.get(blessingCode)
            : plan?.occupiedValue;
          if (dist) {
            distributions.push(dist);
          }
        }
        groupOdds = matchingProbability(distributions, thresholds);
        groupOddsCache.set(cacheKey, groupOdds);
      }

      joint *= groupOdds;
      if (joint === 0) {
        return 0;
      }
    }
    return joint;
  };

  let total = 0;
  let hit = 0;
  forEachSlotAssignment(
    slotBlessingRates.slice(0, activeSlotCount),
    pinned,
    VISIT_EVERY_ASSIGNMENT,
    (assignment, probability) => {
      total += probability;
      for (const [slot, marginals] of marginalsBySlot) {
        const blessingCode = assignment[slot - 1];
        if (blessingCode !== undefined) {
          marginals.set(blessingCode, (marginals.get(blessingCode) ?? 0) + probability);
        }
      }
      hit += probability * targetsProbability(assignment);
    },
  );

  const outcomes: EnhancementSlotOutcome[] = plans.map((plan) => {
    if (!plan.willBeFilled) {
      return {
        slot: plan.slot,
        isFinal: plan.isFinal,
        blessingCode: plan.displayBlessing,
        valueDistribution: plan.occupiedValue,
        candidates: null,
      };
    }

    const marginals = marginalsBySlot.get(plan.slot) ?? new Map<string, number>();
    const values = filledValuesBySlot.get(plan.slot);
    const candidates: EnhancementSlotCandidate[] = [];
    for (const [blessingCode, mass] of marginals) {
      const valueDistribution = values?.get(blessingCode);
      if (valueDistribution && mass > 0) {
        candidates.push({
          blessingCode,
          probability: total > 0 ? mass / total : 0,
          valueDistribution,
        });
      }
    }
    candidates.sort((left, right) => right.probability - left.probability);

    return {
      slot: plan.slot,
      isFinal: false,
      blessingCode: null,
      valueDistribution: null,
      candidates,
    };
  });

  return {
    probability: total > 0 ? hit / total : 0,
    remainingMilestones,
    slots: outcomes,
    missingBlessingData: [...missingBlessingData].sort(),
  };
}
