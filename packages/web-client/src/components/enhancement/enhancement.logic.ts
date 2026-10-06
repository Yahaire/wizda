import { blessingLabel } from '@/components/oracle/oracle.logic';
import { DEFAULT_TARGET_ENHANCEMENT_LEVEL } from '@shared/api/endpoints/enhancementOdds.models';
import {
    checkBlessingSlotState, filledSlotCount, MAX_BLESSING_SLOTS, MAX_ENHANCEMENT_LEVEL,
    milestoneForSlot
} from '@shared/domain/blessingSlots';
import { BLESSINGS } from '@shared/domain/stats';

import type {
  EnhancementOddsQuery,
  EnhancementReference,
  EnhancementSlotState,
  EnhancementTarget,
} from '@shared/api/endpoints/enhancementOdds.models';
import type { SlotStateProblem } from '@shared/domain/blessingSlots';

export { MAX_BLESSING_SLOTS, MAX_ENHANCEMENT_LEVEL, milestoneForSlot };

export const MIN_ENHANCEMENT_LEVEL = 0;

/** Every level at which a milestone fires, ascending: +5, +10, +15, +20. */
export const MILESTONE_LEVELS: readonly number[] = Array.from(
  { length: MAX_BLESSING_SLOTS },
  (_, index) => milestoneForSlot(index + 1),
);

/**
 * The target levels worth offering for a piece sitting at `currentLevel`: every
 * milestone still ahead of it, plus `currentLevel` itself.
 *
 * The milestones are the whole of it because the odds only ever read the target
 * through *which milestones it crosses* (`enhancementMath.ts`'s
 * `enhancementLevel < milestone && milestone <= targetEnhancementLevel`), so a
 * target of +16 through +19 computes exactly what +15 computes. Offering the
 * in-between levels would only invite a player to plan enhancement that buys
 * them nothing.
 *
 * `currentLevel` leads the list as "leave it where it is" — the answer to *what
 * do I have right now?*, which the milestones alone can't express once a piece
 * sits between two of them. At +0 that option **is** +0, so the "how likely was
 * this roll?" reading of an untouched piece falls out of the same rule rather
 * than being a special case. At +20 it is the only entry left, and the field has
 * nothing to ask.
 */
export function targetLevelOptions(currentLevel: number): number[] {
  return [
    currentLevel,
    ...MILESTONE_LEVELS.filter((milestone) => milestone > currentLevel),
  ];
}

/**
 * Moves a stored target back onto {@link targetLevelOptions} after the current
 * level changed under it, in whichever direction it moved.
 *
 * Snapping **down** to the nearest offered level is what keeps a "leave it where
 * it is" target meaning that: correcting a piece from +14 to +10 turns a target
 * of +14 into +10, not into a freshly invented plan to reach +15. Only when the
 * target falls below every option — the current level was raised past it — does
 * the piece's own level take over, since it is already there.
 */
export function normalizeTargetLevel(targetLevel: number, currentLevel: number): number {
  const offered = targetLevelOptions(currentLevel).filter((option) => option <= targetLevel);
  return offered.length > 0 ? offered[offered.length - 1] : currentLevel;
}

/** Sentinel string for a Mantine control's "I don't know" option — never a real code/grade. */
export const NOT_SURE = 'not-sure';

/**
 * One blessing slot exactly as the item screen shows it, plus what the player
 * hopes it ends up as and the two optional refinement-planning fields.
 */
export interface SlotFormState {
  /**
   * The player's own Empty/Filled answer — consulted only while the initial
   * grade is "not sure", since a stated grade settles every slot on its own.
   * See {@link isSlotOccupied}.
   */
  filled: boolean,
  blessingCode: string | null,
  value: number | null,
  /**
   * The blessing the player hopes a milestone puts *here*. Only meaningful on a
   * slot that is still empty and still due a milestone — an occupied slot's
   * blessing never changes. null = "any".
   *
   * Named `wish*` rather than `target*` because `targetEnhancementLevel`
   * already owns that word in this form. Together with {@link wishMinValue}
   * this is what becomes one `EnhancementTarget`; see {@link wishedTargets}.
   */
  wishBlessingCode: string | null,
  /** The value the player hopes this slot reaches, inclusive. null = "any". */
  wishMinValue: number | null,
  /** Whether the "plan a Refinement Stone" sub-panel is open for this slot. */
  planRefine: boolean,
  /** Required once `planRefine` is true; null means unanswered. */
  isRefined: boolean | null,
  planRefineStoneQuality: number | null,
}

export interface EnhancementFormState {
  equipment: string | null,
  quality: number | null,
  /**
   * null = "not sure" — a real, first-class answer, not just unanswered. Any
   * other value settles the piece's whole slot shape; see {@link SlotShape}.
   */
  initialGrade: number | null,
  enhancementLevel: number,
  targetEnhancementLevel: number,
  alteredSlot: number | null,
  /** null = "not sure" when `alteredSlot` is set. */
  alteredFrom: string | null,
  /** Only slots the player has touched need a key; a missing key reads as empty. */
  slots: Record<number, SlotFormState>,
}

export const EMPTY_SLOT_FORM_STATE: SlotFormState = {
  filled: false,
  blessingCode: null,
  value: null,
  wishBlessingCode: null,
  wishMinValue: null,
  planRefine: false,
  isRefined: null,
  planRefineStoneQuality: null,
};

export const DEFAULT_ENHANCEMENT_FORM_STATE: EnhancementFormState = {
  equipment: null,
  quality: null,
  initialGrade: null,
  enhancementLevel: MIN_ENHANCEMENT_LEVEL,
  targetEnhancementLevel: DEFAULT_TARGET_ENHANCEMENT_LEVEL,
  alteredSlot: null,
  alteredFrom: null,
  slots: {},
};

/** Whether the piece section is filled in enough to reveal the rest of the form. */
export function isPieceReady(state: Pick<EnhancementFormState, 'equipment' | 'quality'>): boolean {
  return state.equipment !== null && state.quality !== null;
}

/**
 * The answers that, between them, decide what each of a piece's slots holds
 * and what can still happen to it. `EnhancementFormState` satisfies it
 * structurally, so anything holding the whole form passes it straight through.
 *
 * The first two settle which slots hold a blessing *now*;
 * `targetEnhancementLevel` settles which milestones will still fire, and so
 * which slots are still worth wishing on ({@link slotWishState}).
 */
export interface SlotShape {
  /** null = "not sure" — the only case in which the player marks slots by hand. */
  initialGrade: number | null,
  enhancementLevel: number,
  targetEnhancementLevel: number,
}

/**
 * How many slots the game itself guarantees hold a blessing: the ones the piece
 * came with (`initialGrade - 1`) and the ones a passed milestone filled,
 * whichever prefix is longer — `filledSlotCount`, the same rule the backend
 * validates against.
 *
 * With the grade left at "not sure" this is only a *lower* bound — the piece may
 * well have dropped carrying more, which is exactly what the player then marks
 * by hand. Grade 1 (White) carries nothing at drop, so standing it in for the
 * unknown grade yields precisely the milestone count, and the two cases need no
 * second formula.
 */
export function guaranteedFilledCount(shape: SlotShape): number {
  return filledSlotCount(shape.initialGrade ?? 1, shape.enhancementLevel);
}

/**
 * Whether the piece's slot shape is settled outright, leaving nothing to ask.
 * A stated initial grade does that on its own: filled slots are a prefix, so
 * {@link guaranteedFilledCount} is then its exact length rather than a floor,
 * every slot past it is guaranteed *empty*, and the Empty/Filled question has
 * no answer left to give.
 */
export function isSlotShapeKnown(shape: SlotShape): boolean {
  return shape.initialGrade !== null;
}

/**
 * Whether slot `slot` may be empty. Once its own milestone has fired, or the
 * stated grade says the piece came with it, the game guarantees it holds a
 * blessing, so leaving it unmarked would describe a state the game can't
 * produce.
 */
export function canSlotBeEmpty(slot: number, shape: SlotShape): boolean {
  return slot > guaranteedFilledCount(shape);
}

/**
 * Whether slot `slot` is guaranteed to hold a blessing by the game's own
 * rules, regardless of whether the player has actually typed one in yet —
 * i.e. the negation of {@link canSlotBeEmpty}. Named separately because it
 * reads better at each call site than a double negative.
 */
export function isSlotMandatory(slot: number, shape: SlotShape): boolean {
  return !canSlotBeEmpty(slot, shape);
}

/**
 * Whether slot `slot` is guaranteed *empty* — the player stated a grade, and
 * that grade with this level puts the slot past the piece's last blessing.
 * Nothing to ask and nothing to enter: {@link isSlotMandatory}'s counterpart
 * on the far side of a known prefix.
 */
export function isSlotGuaranteedEmpty(slot: number, shape: SlotShape): boolean {
  return isSlotShapeKnown(shape) && canSlotBeEmpty(slot, shape);
}

/**
 * Whether slot `slot` holds a blessing the piece *came with*, rather than one a
 * milestone put there. Both are equally mandatory — only the reason differs,
 * and the reason is what's worth showing beside a slot the player can't toggle.
 */
export function isSlotFilledAtDrop(slot: number, shape: SlotShape): boolean {
  return shape.initialGrade !== null && slot <= shape.initialGrade - 1;
}

/**
 * Whether slot `slot` currently holds a blessing: either the rules already
 * guarantee it ({@link isSlotMandatory}) or — with the grade unknown — the
 * player has explicitly marked it Filled. A mandatory slot counts as occupied
 * here even before its blessing/value have been typed in — {@link canCalculate}
 * is what still requires that data before Calculate is allowed.
 *
 * A stated grade settles every slot, so `filled` is *ignored* there rather than
 * cleared: a player who described their slots under "Not sure", then remembered
 * the grade, gets that description back if they change their mind again.
 */
export function isSlotOccupied(
  slot: number,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
): boolean {
  if (isSlotMandatory(slot, shape)) {
    return true;
  }
  return !isSlotShapeKnown(shape) && Boolean(slots[slot]?.filled);
}

/** How one slot's row presents itself. The three states are exhaustive. */
export enum SlotDisplayState {
  /** Guaranteed to hold a blessing: its fields, and no Empty/Filled choice. */
  MANDATORY = 'MANDATORY',
  /** The player can say whether it holds anything, in any order they like. */
  OPTIONAL = 'OPTIONAL',
  /** A stated grade puts this slot past the piece's last blessing. */
  GUARANTEED_EMPTY = 'GUARANTEED_EMPTY',
}

/**
 * The one branch `SlotEditor` renders on, kept here so the reasoning about
 * which slots are settled and which are still a question lives beside the rules
 * it follows from — and stays under test.
 *
 * Slots are **not** gated top-to-bottom: a player may mark slot 3 Filled before
 * slot 1, since that's how they'd read an item screen that already shows every
 * slot at once. A shape the game can't produce (a gap, or a milestone-mandatory
 * slot left empty) is instead caught at Calculate time by
 * {@link slotStateProblem}, which explains the problem rather than silently
 * refusing to show the field.
 */
export function slotDisplayState(
  slot: number,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
): SlotDisplayState {
  if (isSlotMandatory(slot, shape)) {
    return SlotDisplayState.MANDATORY;
  }
  if (isSlotShapeKnown(shape)) {
    return SlotDisplayState.GUARANTEED_EMPTY;
  }
  return SlotDisplayState.OPTIONAL;
}

/** What, if anything, a slot's row can be asked to hope for. The four states are exhaustive. */
export enum SlotWishState {
  /** Occupied and still due a milestone: the blessing is fixed, only its value can move. */
  VALUE_ONLY = 'VALUE_ONLY',
  /** Empty, and a milestone will fill it: both what lands here and how big it is are open. */
  BLESSING_AND_VALUE = 'BLESSING_AND_VALUE',
  /** Occupied, with no milestone left to touch it — what it shows now is what it ends as. */
  NONE_FINAL = 'NONE_FINAL',
  /** Empty, and its milestone lies past the target level — nothing will be rolled here. */
  NONE_UNREACHED = 'NONE_UNREACHED',
}

/**
 * Whether slot `slot` will be touched at all on the way to the target level:
 * its milestone must still be ahead of where the piece is *and* within where
 * it's going. Below that, nothing about the slot can change, which is what
 * makes a wish on it pointless rather than merely unlikely.
 */
function isSlotStillDue(slot: number, shape: SlotShape): boolean {
  const milestone = milestoneForSlot(slot);
  return milestone > shape.enhancementLevel && milestone <= shape.targetEnhancementLevel;
}

/**
 * The second branch `SlotEditor` renders on, beside {@link slotDisplayState}:
 * what this slot can still be hoped for. An occupied slot's blessing never
 * changes — a milestone only adds to its value (`docs/calculation/enhancement.md`)
 * — so only a still-empty slot is asked *which* blessing, and only a slot with
 * a milestone still coming is asked anything at all.
 *
 * The two `NONE_*` states are kept apart because they read as different rows to
 * the player: one is settled by what the piece already shows, the other by how
 * far they've said they'll take it — and only the second changes if they move
 * the target level.
 */
export function slotWishState(
  slot: number,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
): SlotWishState {
  const occupied = isSlotOccupied(slot, slots, shape);
  if (!isSlotStillDue(slot, shape)) {
    return occupied ? SlotWishState.NONE_FINAL : SlotWishState.NONE_UNREACHED;
  }
  return occupied ? SlotWishState.VALUE_ONLY : SlotWishState.BLESSING_AND_VALUE;
}

/**
 * The wishes the player has actually expressed, as the flat `EnhancementTarget`
 * list the API takes — ANDed, each satisfied by a *distinct* slot.
 *
 * Two things are deliberately dropped on the way:
 *
 * - A wish on a slot whose row isn't asking for one (a lowered target level
 *   hid it, say) is ignored rather than cleared. Nothing invisible reaches the
 *   query, and raising the level again brings the wish back — the same stance
 *   {@link isSlotOccupied} takes on `filled` under a stated grade.
 * - An "any value" wish on an *occupied* slot emits nothing. It names a
 *   blessing the piece already carries with no floor on it, so it is satisfied
 *   by its own slot unconditionally and can never block the matching.
 *
 * One imprecision is inherent and worth naming: a wish is *written* per slot
 * but *scored* slot-agnostically, so `ATK ≥ 16` wished on slot 1 may be met by
 * a different ATK slot. That needs two ATK slots, which needs alteration in
 * play (a milestone avoids the piece's initial blessings — see
 * `docs/milestone-blessings.md`); on an unaltered piece the blessings are
 * distinct and the per-slot reading is exact.
 */
export function wishedTargets(state: EnhancementFormState): EnhancementTarget[] {
  const targets: EnhancementTarget[] = [];
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    const slotState = state.slots[slot];
    if (!slotState) {
      continue;
    }
    const wishState = slotWishState(slot, state.slots, state);
    if (wishState === SlotWishState.VALUE_ONLY) {
      if (slotState.blessingCode !== null && slotState.wishMinValue !== null) {
        targets.push({ blessingCode: slotState.blessingCode, minValue: slotState.wishMinValue });
      }
      continue;
    }
    if (wishState === SlotWishState.BLESSING_AND_VALUE && slotState.wishBlessingCode !== null) {
      targets.push({
        blessingCode: slotState.wishBlessingCode,
        ...(slotState.wishMinValue !== null && { minValue: slotState.wishMinValue }),
      });
    }
  }
  return targets;
}

/** The `occupiedSlots` boolean[4] `checkBlessingSlotState` expects, from form state. */
export function occupiedSlotsOf(slots: Record<number, SlotFormState>, shape: SlotShape): boolean[] {
  return Array.from(
    { length: MAX_BLESSING_SLOTS },
    (_unused, index) => isSlotOccupied(index + 1, slots, shape),
  );
}

/**
 * Whether the slots as currently marked describe a shape the game can
 * actually produce. With slots fillable in any order (see
 * {@link slotDisplayState}), a player can genuinely produce a `GAP` (slot 3
 * Filled, slot 1 not) — this is what {@link canCalculate} leans on to block
 * Calculate until they fix it, surfaced to the player via the returned
 * message. `MISSING_MILESTONE_FILL` and `GRADE_MISMATCH` both stay
 * unreachable: {@link isSlotOccupied} reports a mandatory slot as occupied
 * unconditionally (and `SlotEditor` never even offers it an Empty/Filled
 * toggle), so a passed milestone's slot can't be marked empty; and once a
 * grade is stated, occupancy is *derived* from it rather than cross-checked
 * against it, so a stated grade can no longer disagree with slots it dictates.
 *
 * Takes `slots`/`shape` separately (rather than the whole form) so
 * `SlotEditor` — which already holds both — can call it directly to warn the
 * player in place, instead of waiting for a Calculate attempt to fail.
 */
export function slotStateProblem(
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
): SlotStateProblem | null {
  return checkBlessingSlotState(
    occupiedSlotsOf(slots, shape),
    shape.enhancementLevel,
    shape.initialGrade,
  );
}

/**
 * Puts the form back in a consistent state after any field moved.
 *
 * Only one thing can be stranded: an alteration declared on a slot that has
 * since stopped being occupied. Three different fields can do it — the slot's
 * own Empty/Filled toggle, the initial grade, and the enhancement level all
 * move which slots hold a blessing — so every patch runs through here rather
 * than each field having to remember. Leaving it stale would silently disable
 * Calculate (via {@link canCalculate}) with nothing on screen to explain why.
 */
export function reconcileFormState(state: EnhancementFormState): EnhancementFormState {
  if (state.alteredSlot === null || isSlotOccupied(state.alteredSlot, state.slots, state)) {
    return state;
  }
  return { ...state, alteredSlot: null, alteredFrom: null };
}

/** Whether a slot's refinement plan is complete enough to submit. */
function isRefinePlanReady(slot: SlotFormState): boolean {
  return !slot.planRefine || (slot.isRefined === false && slot.planRefineStoneQuality !== null);
}

/**
 * Everything Calculate needs before it's worth a round trip. Mirrors the
 * backend's own `validateQuery` shape checks (see `enhancementOdds.ts`) so a
 * doomed request never leaves the client, but doesn't re-derive anything the
 * form already prevents by construction.
 */
export function canCalculate(state: EnhancementFormState): boolean {
  if (!isPieceReady(state)) {
    return false;
  }
  if (wishedTargets(state).length === 0) {
    return false; // nothing hoped for anywhere — there'd be nothing to compute
  }
  if (slotStateProblem(state.slots, state) !== null) {
    return false;
  }
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    if (!isSlotOccupied(slot, state.slots, state)) {
      continue;
    }
    const slotState = state.slots[slot];
    if (!slotState?.blessingCode || slotState.value === null) {
      return false; // occupied (maybe only by the game's own rules) but not yet described
    }
    if (!isRefinePlanReady(slotState)) {
      return false;
    }
  }
  if (state.alteredSlot !== null && !isSlotOccupied(state.alteredSlot, state.slots, state)) {
    return false;
  }
  return true;
}

/**
 * `initialGrade` left at "not sure" — inert on the odds, shown as a reassurance,
 * not a warning. All it costs is the slot bookkeeping: the player marks Empty or
 * Filled themselves instead of the grade doing it for them.
 */
export function isInitialGradeUnknown(state: EnhancementFormState): boolean {
  return state.initialGrade === null;
}

/**
 * This piece is declared altered, but the player doesn't remember what the
 * slot originally rolled — a real precision caveat (the odds average over
 * every possibility), unlike {@link isInitialGradeUnknown}.
 */
export function isAlteredOriginUnknown(state: EnhancementFormState): boolean {
  return state.alteredSlot !== null && state.alteredFrom === null;
}

/** Slots eligible to be named as "the altered one" — must currently be occupied. */
export function alterableSlots(slots: Record<number, SlotFormState>, shape: SlotShape): number[] {
  const result: number[] = [];
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    if (isSlotOccupied(slot, slots, shape)) {
      result.push(slot);
    }
  }
  return result;
}

/**
 * Blessing options for one slot's picker: restricted to what the reference
 * endpoint says can actually roll there, falling back to the full catalog when
 * that data is missing (`NO_BLESSING_RATES`, or simply no reference loaded
 * yet) — degrade gracefully rather than block the field.
 */
export function slotBlessingOptions(
  slot: number,
  reference: EnhancementReference | null,
): { value: string, label: string }[] {
  const rates = reference?.slots[slot - 1]?.rates ?? [];
  const codes = rates.length > 0 ? rates.map((rate) => rate.blessingCode) : BLESSINGS.map((blessing) => blessing.code);
  return codes.map((code) => ({ value: code, label: blessingLabel(code) }));
}

/** A value distribution's inclusive range as a compact label: "8-10", or "8" for a single value. */
export function formatValueRange(dist: { minValue: number, probabilities: readonly number[] }): string {
  const max = dist.minValue + dist.probabilities.length - 1;
  return dist.minValue === max ? String(dist.minValue) : `${dist.minValue}-${max}`;
}

/** Every blessing in the catalog, for the target/alteration pickers (unfiltered in this pass). */
export function allBlessingOptions(): { value: string, label: string }[] {
  return BLESSINGS.map((blessing) => ({ value: blessing.code, label: blessingLabel(blessing.code) }));
}

/** The `{ equipment, quality }` pair to fetch `GET /enhancement-odds/reference` with, or null. */
export function buildReferenceParams(
  state: EnhancementFormState,
): { equipment: string, quality: number } | null {
  if (!isPieceReady(state)) {
    return null;
  }
  return { equipment: state.equipment!, quality: state.quality! };
}

/**
 * Assembles the `POST /enhancement-odds` body from form state. Returns null
 * when the piece section isn't filled in yet — callers should already be
 * gating on {@link canCalculate} before this ever matters.
 *
 * A slot's refinement plan is only carried across when it's actually ready
 * (see {@link isRefinePlanReady}) — `isRefined: true` is blocked and explained
 * in the UI rather than ever reaching a request, per `ALREADY_REFINED`.
 */
export function buildEnhancementQuery(state: EnhancementFormState): EnhancementOddsQuery | null {
  if (!isPieceReady(state)) {
    return null;
  }

  const slots: EnhancementSlotState[] = [];
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    if (!isSlotOccupied(slot, state.slots, state)) {
      continue;
    }
    const slotState = state.slots[slot];
    if (!slotState?.blessingCode || slotState.value === null) {
      continue; // occupied by rule but not yet described — canCalculate should have caught this
    }
    const refineActive = slotState.planRefine
      && slotState.isRefined === false
      && slotState.planRefineStoneQuality !== null;
    slots.push({
      slot,
      blessingCode: slotState.blessingCode,
      value: slotState.value,
      ...(refineActive && {
        isRefined: false,
        planRefineStoneQuality: slotState.planRefineStoneQuality!,
      }),
    });
  }

  return {
    equipment: state.equipment!,
    quality: state.quality!,
    enhancementLevel: state.enhancementLevel,
    targetEnhancementLevel: state.targetEnhancementLevel,
    ...(state.initialGrade !== null && { initialGrade: state.initialGrade }),
    ...(state.alteredSlot !== null && { alteredSlot: state.alteredSlot }),
    ...(state.alteredSlot !== null && state.alteredFrom !== null && { alteredFrom: state.alteredFrom }),
    slots,
    targets: wishedTargets(state),
  };
}
