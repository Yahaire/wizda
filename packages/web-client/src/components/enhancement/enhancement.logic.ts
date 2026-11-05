import { blessingLabel } from '@/components/oracle/oracle.logic';
import { DEFAULT_TARGET_ENHANCEMENT_LEVEL } from '@shared/api/endpoints/enhancementOdds.models';
import {
    checkBlessingSlotState, filledSlotCount, isMilestoneAhead, MAX_BLESSING_SLOTS,
    MAX_ENHANCEMENT_LEVEL, milestoneForSlot, willFillAnySlot
} from '@shared/domain/blessingSlots';
import { BLESSINGS } from '@shared/domain/stats';

import type {
  EnhancementOddsQuery,
  EnhancementReference,
  EnhancementSlotState,
  EnhancementTarget,
} from '@shared/api/endpoints/enhancementOdds.models';
import type { SlotStateProblem } from '@shared/domain/blessingSlots';
import type { ValueDistribution } from '@shared/domain/enhancementMath';

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
  /** The value {@link wishBlessingCode} is hoped to land at, inclusive. null = "any". */
  wishMinValue: number | null,
  /**
   * The value the blessing this slot *already holds* is hoped to reach,
   * inclusive. null = "any". Kept apart from {@link wishMinValue} because the
   * two floors are about different blessings: a grade or level that turns an
   * empty slot occupied must not quietly re-aim "ATK ≥ 16" at whatever the
   * slot shows — each mode keeps its own number, and gets it back on return.
   */
  heldWishMinValue: number | null,
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
   * null = "not sure" — a real, first-class answer, not just unanswered (that's
   * {@link gradeAnswered}). Any other value settles the piece's whole slot
   * shape; see {@link SlotShape}.
   */
  initialGrade: number | null,
  /**
   * Whether the player has picked anything for {@link initialGrade} yet,
   * "Not sure" included. The slots stay hidden until they have: a grade
   * defaulting to "Not sure" read as answered, so a player could describe
   * every slot before noticing it — and then picking the real grade
   * reshuffled the rows they'd just filled in.
   */
  gradeAnswered: boolean,
  enhancementLevel: number,
  targetEnhancementLevel: number,
  /** Only slots the player has touched need a key; a missing key reads as empty. */
  slots: Record<number, SlotFormState>,
}

export const EMPTY_SLOT_FORM_STATE: SlotFormState = {
  filled: false,
  blessingCode: null,
  value: null,
  wishBlessingCode: null,
  wishMinValue: null,
  heldWishMinValue: null,
  planRefine: false,
  isRefined: null,
  planRefineStoneQuality: null,
};

export const DEFAULT_ENHANCEMENT_FORM_STATE: EnhancementFormState = {
  equipment: null,
  quality: null,
  initialGrade: null,
  gradeAnswered: false,
  enhancementLevel: MIN_ENHANCEMENT_LEVEL,
  targetEnhancementLevel: DEFAULT_TARGET_ENHANCEMENT_LEVEL,
  slots: {},
};

/**
 * Whether the form is exactly as a first visit finds it — nothing for Reset to
 * do, so it isn't offered. Compared by value: a slot the player touched and
 * emptied again leaves a key behind, and is something to reset all the same.
 */
export function isFormUntouched(state: EnhancementFormState): boolean {
  return JSON.stringify(state) === JSON.stringify(DEFAULT_ENHANCEMENT_FORM_STATE);
}

/** Whether the piece section is filled in enough to reveal the rest of the form. */
export function isPieceReady(
  state: Pick<EnhancementFormState, 'equipment' | 'quality' | 'gradeAnswered'>,
): boolean {
  return state.equipment !== null && state.quality !== null && state.gradeAnswered;
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
 * player has explicitly marked it Filled. A slot counts as occupied here
 * whether or not its blessing/value have been typed in — how much of that the
 * answer needs is {@link isSlotBlessingRequired} / {@link isSlotValueRequired}.
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
  return isMilestoneAhead(slot, shape.enhancementLevel, shape.targetEnhancementLevel);
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
 *   {@link isSlotOccupied} takes on `filled` under a stated grade. Each kind of
 *   row reads its own floor (`wishMinValue` / `heldWishMinValue`), so a slot
 *   changing kind never carries one blessing's number over to another.
 * - An "any value" wish on an *occupied* slot emits nothing. It names a
 *   blessing the piece already carries with no floor on it, so it is satisfied
 *   by its own slot unconditionally and can never block the matching.
 *
 * One imprecision is inherent and worth naming: a wish is *written* per slot
 * but *scored* slot-agnostically, so `ATK ≥ 16` wished on slot 1 may be met by
 * a different ATK slot. That needs two ATK slots, which only an Alteration
 * Stone can produce (a milestone never rolls a blessing the piece already
 * shows — see `docs/milestone-blessings.md`); on an unaltered piece the
 * blessings are distinct and the per-slot reading is exact.
 */
export function wishedTargets(state: SlotShape & Pick<EnhancementFormState, 'slots'>): EnhancementTarget[] {
  const targets: EnhancementTarget[] = [];
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    const slotState = state.slots[slot];
    if (!slotState) {
      continue;
    }
    const wishState = slotWishState(slot, state.slots, state);
    if (wishState === SlotWishState.VALUE_ONLY) {
      if (slotState.blessingCode !== null && slotState.heldWishMinValue !== null) {
        targets.push({ blessingCode: slotState.blessingCode, minValue: slotState.heldWishMinValue });
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

/**
 * Whether a milestone will put a blessing into a slot that's empty now. Then
 * every blessing the piece shows shapes the answer — a fill never rolls one —
 * so each occupied slot has to say which it holds.
 */
export function isFillAhead(slots: Record<number, SlotFormState>, shape: SlotShape): boolean {
  return willFillAnySlot(occupiedSlotsOf(slots, shape), shape.enhancementLevel, shape.targetEnhancementLevel);
}

/** Whether slot `slot` has a value floor wished on it — the one wish on an occupied slot that sends anything. */
function hasValueWish(slot: number, slots: Record<number, SlotFormState>, shape: SlotShape): boolean {
  return slotWishState(slot, slots, shape) === SlotWishState.VALUE_ONLY
    && (slots[slot]?.heldWishMinValue ?? null) !== null;
}

/**
 * Whether an occupied slot has to name its blessing before Calculate. Only
 * where the answer depends on it (`docs/calculation/enhancement.md`, "What has
 * to be transcribed"): a fill is ahead ({@link isFillAhead}), or the slot's own
 * value wish or Refinement Stone plan is about that blessing.
 *
 * Otherwise it's left optional on purpose — on a piece with nothing left to
 * fill, a slot nobody's asking about can't move the odds, and making the player
 * copy it out anyway is just friction.
 */
export function isSlotBlessingRequired(
  slot: number,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
): boolean {
  if (!isSlotOccupied(slot, slots, shape)) {
    return false;
  }
  return isFillAhead(slots, shape)
    || hasValueWish(slot, slots, shape)
    || Boolean(slots[slot]?.planRefine);
}

/**
 * Whether an occupied slot has to give its value before Calculate: its own
 * value wish or Refinement Stone plan builds on that number, or another slot's
 * wish names the blessing it shows — wishes are scored slot-agnostically (see
 * {@link wishedTargets}), so any slot showing that blessing is in play.
 */
export function isSlotValueRequired(
  slot: number,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
): boolean {
  if (!isSlotOccupied(slot, slots, shape)) {
    return false;
  }
  if (hasValueWish(slot, slots, shape) || slots[slot]?.planRefine) {
    return true;
  }
  const blessingCode = slots[slot]?.blessingCode ?? null;
  return blessingCode !== null
    && wishedTargets({ ...shape, slots }).some((target) => target.blessingCode === blessingCode);
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
 * Only one thing can be stranded: a wish, on a slot a milestone will fill, for
 * a blessing the piece has since come to display — the player typed it into
 * another slot, or a stated grade or level made that slot occupied. A milestone
 * never rolls a blessing already on the piece, so the wish has become a
 * guaranteed 0% and its option in the picker is greyed out
 * ({@link wishBlessingOptions}). Cleared rather than ignored, unlike a wish a
 * lowered target level merely hides: that one comes back when the level does,
 * while this one can't be granted at all while the piece looks like this.
 * Every patch runs through here rather than each field having to remember.
 */
export function reconcileFormState(state: EnhancementFormState): EnhancementFormState {
  const displayed = displayedBlessings(state.slots, state);
  let next = state;
  for (const [key, slotState] of Object.entries(state.slots)) {
    const slot = Number(key);
    const impossible = slotState.wishBlessingCode !== null
      && displayed.has(slotState.wishBlessingCode)
      && !isSlotOccupied(slot, state.slots, state);
    if (!impossible) {
      continue;
    }
    next = {
      ...next,
      slots: {
        ...next.slots,
        [slot]: { ...slotState, wishBlessingCode: null, wishMinValue: null },
      },
    };
  }
  return next;
}

/**
 * Whether slot `slot` carries a wish the player can see on its row: a hoped-for
 * blessing on a slot a milestone will fill, or a floor on what an occupied slot
 * already holds.
 */
function hasVisibleWish(slot: number, slots: Record<number, SlotFormState>, shape: SlotShape): boolean {
  return (
    slotWishState(slot, slots, shape) === SlotWishState.BLESSING_AND_VALUE
    && (slots[slot]?.wishBlessingCode ?? null) !== null
  ) || hasValueWish(slot, slots, shape);
}

/**
 * The slots whose wish was on screen in `before` and isn't in `after`, in slot
 * order — what a change to the grade or a level just put out of sight. Mostly
 * the wish is only hidden (see {@link wishedTargets}) and comes back with the
 * answer that hid it, but nothing on the row says so, which is why the page
 * offers the undo itself.
 */
export function setAsideWishSlots(before: EnhancementFormState, after: EnhancementFormState): number[] {
  return Array.from({ length: MAX_BLESSING_SLOTS }, (_unused, index) => index + 1).filter(
    (slot) => hasVisibleWish(slot, before.slots, before) && !hasVisibleWish(slot, after.slots, after),
  );
}

/**
 * localStorage key for the form as it stood at the last successful Calculate
 * (bump on an incompatible shape change).
 */
export const LAST_CALCULATED_STORAGE_KEY = 'wizda.enhancement.lastCalculated.v1';

/**
 * Turns whatever was stored under {@link LAST_CALCULATED_STORAGE_KEY} back into
 * a form state, or null when there's nothing worth restoring.
 *
 * Stored by an older build is the case to survive: every field is merged over
 * its default, so one added since comes back at its starting value rather than
 * `undefined`; slots outside 1..4 are dropped; and the result is run through
 * the same normalization every edit gets ({@link normalizeTargetLevel},
 * {@link reconcileFormState}), in case those rules moved since it was saved.
 * A piece that wasn't even chosen is nothing to restore.
 *
 * Only a form that calculated is ever stored, so its grade was answered —
 * which an older build, predating {@link EnhancementFormState.gradeAnswered},
 * never wrote down. That build also kept both of a slot's floors in
 * `wishMinValue`; one sitting on a slot that only takes a floor on what it
 * already holds is moved to {@link SlotFormState.heldWishMinValue}, where it
 * belongs now.
 */
export function restoreFormState(stored: unknown): EnhancementFormState | null {
  if (typeof stored !== 'object' || stored === null) {
    return null;
  }
  const merged: EnhancementFormState = {
    ...DEFAULT_ENHANCEMENT_FORM_STATE,
    ...stored,
    gradeAnswered: true,
  };
  if (!isPieceReady(merged)) {
    return null;
  }
  const slots: Record<number, SlotFormState> = {};
  const predatesHeldFloor: number[] = [];
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    const slotState = merged.slots?.[slot];
    if (!slotState) {
      continue;
    }
    slots[slot] = { ...EMPTY_SLOT_FORM_STATE, ...slotState };
    if (!('heldWishMinValue' in slotState)) {
      predatesHeldFloor.push(slot);
    }
  }
  const shape: SlotShape = {
    ...merged,
    targetEnhancementLevel: normalizeTargetLevel(merged.targetEnhancementLevel, merged.enhancementLevel),
  };
  for (const slot of predatesHeldFloor) {
    if (slotWishState(slot, slots, shape) !== SlotWishState.VALUE_ONLY) {
      continue;
    }
    slots[slot] = { ...slots[slot], heldWishMinValue: slots[slot].wishMinValue, wishMinValue: null };
  }
  return reconcileFormState({
    ...merged,
    targetEnhancementLevel: shape.targetEnhancementLevel,
    slots,
  });
}

/**
 * The form as it stood at this player's last successful Calculate — most come
 * back to re-ask about the same piece after enhancing it a little further.
 *
 * Falls back to null on everything unreadable: no `window` (prerender), storage
 * that throws (privacy-locked browsers), unparseable JSON, or a stored shape
 * {@link restoreFormState} can't use.
 */
export function readLastCalculated(): EnhancementFormState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LAST_CALCULATED_STORAGE_KEY);
    return raw ? restoreFormState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Remembers `state` for {@link readLastCalculated}. Saved on a successful
 * Calculate only, never per edit: a form abandoned halfway is not what the
 * player wants handed back, and only a form that calculated once is known to
 * pass {@link canCalculate}.
 */
export function storeLastCalculated(state: EnhancementFormState): void {
  try {
    window.localStorage.setItem(LAST_CALCULATED_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or a privacy lock — remembering is a convenience, never worth an error.
  }
}

/**
 * Drops what {@link storeLastCalculated} remembered, so a form the player reset
 * isn't handed back on their next visit.
 */
export function forgetLastCalculated(): void {
  try {
    window.localStorage.removeItem(LAST_CALCULATED_STORAGE_KEY);
  } catch {
    // Same as storing: nothing worth an error.
  }
}

/**
 * The Refinement Stone a slot's plan will actually send: its quality, or null
 * while the plan is closed, incomplete, or blocked (`isRefined: true` is
 * explained in the UI and never reaches a request — see `ALREADY_REFINED`).
 * One rule for both the query and the preview, so the picture can't promise a
 * stone the request won't carry.
 */
export function plannedRefineStoneQuality(slot: SlotFormState): number | null {
  if (!slot.planRefine || slot.isRefined !== false) {
    return null;
  }
  return slot.planRefineStoneQuality;
}

/** One thing still standing between the form and Calculate. The kinds are exhaustive. */
export enum CalculateBlockerKind {
  /** The piece section isn't filled in — the slots aren't even on screen yet. */
  PIECE_INCOMPLETE = 'PIECE_INCOMPLETE',
  /** An occupied slot with no blessing picked, where the answer needs it — see {@link isSlotBlessingRequired}. */
  SLOT_BLESSING = 'SLOT_BLESSING',
  /** An occupied slot with no value typed, where the answer needs it — see {@link isSlotValueRequired}. */
  SLOT_VALUE = 'SLOT_VALUE',
  /** Nothing hoped for anywhere, though some slot could be asked — there'd be nothing to compute. */
  NO_WISH = 'NO_WISH',
  /** A refinement plan that hasn't said whether the slot is already refined. */
  REFINE_ANSWER = 'REFINE_ANSWER',
  /** A refinement plan on an already-refined slot — explained in place, never sent (`ALREADY_REFINED`). */
  REFINE_UNSUPPORTED = 'REFINE_UNSUPPORTED',
  /** A refinement plan with no stone quality picked. */
  REFINE_STONE = 'REFINE_STONE',
  /** The slots as marked describe a shape the game can't produce — see {@link slotStateProblem}. */
  SLOT_SHAPE = 'SLOT_SHAPE',
  /** No milestone lies between the current and target levels, so no slot can be wished on. */
  NO_MILESTONE_AHEAD = 'NO_MILESTONE_AHEAD',
}

/** The control inside a slot's row a blocker points at. */
export enum SlotField {
  BLESSING = 'BLESSING',
  VALUE = 'VALUE',
  /** The row's first wish control — the blessing picker on an empty slot, the value on an occupied one. */
  WISH = 'WISH',
  REFINED = 'REFINED',
  REFINE_STONE = 'REFINE_STONE',
}

/**
 * Which control each blocker is fixed in, or null for one that belongs to the
 * form as a whole rather than to a field (the red slot-shape Alert, or the
 * target level the player would have to raise).
 */
const BLOCKER_FIELD: Record<CalculateBlockerKind, SlotField | null> = {
  [CalculateBlockerKind.PIECE_INCOMPLETE]: null,
  [CalculateBlockerKind.SLOT_BLESSING]: SlotField.BLESSING,
  [CalculateBlockerKind.SLOT_VALUE]: SlotField.VALUE,
  [CalculateBlockerKind.NO_WISH]: SlotField.WISH,
  [CalculateBlockerKind.REFINE_ANSWER]: SlotField.REFINED,
  [CalculateBlockerKind.REFINE_UNSUPPORTED]: SlotField.REFINED,
  [CalculateBlockerKind.REFINE_STONE]: SlotField.REFINE_STONE,
  [CalculateBlockerKind.SLOT_SHAPE]: null,
  [CalculateBlockerKind.NO_MILESTONE_AHEAD]: null,
};

export interface CalculateBlocker {
  kind: CalculateBlockerKind,
  /** The slot whose row holds the fix, or null for a form-wide blocker. */
  slot: number | null,
}

/** The control a blocker is fixed in, or null when it's form-wide. */
export function blockerField(blocker: CalculateBlocker): SlotField | null {
  return BLOCKER_FIELD[blocker.kind];
}

/**
 * The blockers that live in one slot's row, in the order its controls are
 * drawn: what the item shows now, then the wish, then the refinement plan.
 */
function slotRowBlockers(
  slot: number,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
  owesWish: boolean,
): CalculateBlockerKind[] {
  const slotState = slots[slot] ?? EMPTY_SLOT_FORM_STATE;
  const kinds: CalculateBlockerKind[] = [];
  if (!slotState.blessingCode && isSlotBlessingRequired(slot, slots, shape)) {
    kinds.push(CalculateBlockerKind.SLOT_BLESSING);
  }
  if (slotState.value === null && isSlotValueRequired(slot, slots, shape)) {
    kinds.push(CalculateBlockerKind.SLOT_VALUE);
  }
  if (owesWish) {
    kinds.push(CalculateBlockerKind.NO_WISH);
  }
  // The plan's panel is only drawn on an occupied row.
  if (!isSlotOccupied(slot, slots, shape) || !slotState.planRefine) {
    return kinds;
  }
  if (slotState.isRefined === null) {
    kinds.push(CalculateBlockerKind.REFINE_ANSWER);
  } else if (slotState.isRefined) {
    kinds.push(CalculateBlockerKind.REFINE_UNSUPPORTED);
  } else if (slotState.planRefineStoneQuality === null) {
    kinds.push(CalculateBlockerKind.REFINE_STONE);
  }
  return kinds;
}

/**
 * Everything Calculate still needs before it's worth a round trip, in the
 * order the player meets it on screen: slot by slot, each row's fields top to
 * bottom, then whatever belongs to the form as a whole. The first entry is the
 * one a blocked Calculate sends the player to.
 *
 * Mirrors the backend's own `validateQuery` shape checks (see
 * `enhancementOdds.ts`) so a doomed request never leaves the client, but
 * doesn't re-derive anything the form already prevents by construction.
 *
 * A missing wish is pinned to the first row that can take one, so it has a
 * field to point at like every other gap. With no such row there's no field to
 * fill — only the target level to raise — which is its own, form-wide kind.
 */
export function calculateBlockers(state: EnhancementFormState): CalculateBlocker[] {
  if (!isPieceReady(state)) {
    return [{ kind: CalculateBlockerKind.PIECE_INCOMPLETE, slot: null }];
  }

  const slotNumbers = Array.from({ length: MAX_BLESSING_SLOTS }, (_unused, index) => index + 1);
  // A floor on a slot whose blessing isn't named yet is a wish all the same —
  // the blessing it's waiting on is its own blocker.
  const missingWish = wishedTargets(state).length === 0
    && !slotNumbers.some((slot) => hasValueWish(slot, state.slots, state));
  // A row can take a wish exactly while its milestone is still due — see `slotWishState`.
  const wishSlot = missingWish
    ? (slotNumbers.find((slot) => isSlotStillDue(slot, state)) ?? null)
    : null;

  const blockers: CalculateBlocker[] = slotNumbers.flatMap((slot) => slotRowBlockers(
    slot,
    state.slots,
    state,
    slot === wishSlot,
  ).map((kind) => ({ kind, slot })));

  if (slotStateProblem(state.slots, state) !== null) {
    blockers.push({ kind: CalculateBlockerKind.SLOT_SHAPE, slot: null });
  }
  if (missingWish && wishSlot === null) {
    blockers.push({ kind: CalculateBlockerKind.NO_MILESTONE_AHEAD, slot: null });
  }
  return blockers;
}

/** Whether Calculate may run: {@link calculateBlockers} has nothing left to say. */
export function canCalculate(state: EnhancementFormState): boolean {
  return calculateBlockers(state).length === 0;
}

/** The fields to mark as still needed in one slot's row. */
export function missingSlotFields(blockers: readonly CalculateBlocker[], slot: number): Set<SlotField> {
  const fields = new Set<SlotField>();
  for (const blocker of blockers) {
    const field = blockerField(blocker);
    if (blocker.slot === slot && field !== null) {
      fields.add(field);
    }
  }
  return fields;
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
 * The blessings the piece shows right now — what every remaining milestone will
 * avoid, whatever put each one there (`docs/milestone-blessings.md`, "Duplicate
 * blessings"). A set: a piece altered into showing the same blessing twice
 * excludes it once, which is all the game does with it.
 */
export function displayedBlessings(slots: Record<number, SlotFormState>, shape: SlotShape): Set<string> {
  const displayed = new Set<string>();
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    const blessingCode = slots[slot]?.blessingCode ?? null;
    if (blessingCode !== null && isSlotOccupied(slot, slots, shape)) {
      displayed.add(blessingCode);
    }
  }
  return displayed;
}

/**
 * What an empty slot's wish picker offers: {@link slotBlessingOptions}, with
 * every blessing the piece already displays greyed out rather than hidden. A
 * milestone can't roll one of those, so wishing for it would be a silent 0%;
 * leaving it visible but disabled is what tells the player *why* it isn't on
 * offer. {@link reconcileFormState} clears a wish that lands in this state.
 */
export function wishBlessingOptions(
  slot: number,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
  reference: EnhancementReference | null,
): { value: string, label: string, disabled: boolean }[] {
  const displayed = displayedBlessings(slots, shape);
  return slotBlessingOptions(slot, reference).map((option) => ({
    ...option,
    disabled: displayed.has(option.value),
  }));
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

/** One line of a slot's odds list: a blessing, and its chance of landing in that slot. */
export interface SlotOdds {
  blessingCode: string,
  probability: number,
  /** The range it would roll in, where that is worth showing beside the odds. */
  valueDistribution?: ValueDistribution,
}

/**
 * A slot's odds list in reading order: the blessing the row is about first —
 * the one wished for, or the one the slot holds — then the rest, best odds
 * first. With nothing to pin, the list is left as it came.
 */
export function pinBlessingFirst<T extends SlotOdds>(lines: readonly T[], blessingCode: string | null): T[] {
  const pinned = lines.find((line) => line.blessingCode === blessingCode);
  if (!pinned) {
    return [...lines];
  }
  return [pinned, ...lines.filter((line) => line !== pinned)];
}

/**
 * How likely each blessing was to land in an already-rolled slot, best odds
 * first: the slot's published rates, less any blessing a lower slot shows —
 * slots fill in order and never repeat one, so those were off the table when
 * this one rolled. Read as a reroll, which renormalizes over what's left; the
 * same assumption the Junk Oracle flags (`oracle.estimateNote`).
 *
 * An estimate of the slot's history, not of anything ahead — an Alteration
 * Stone can have reshuffled the order since. Empty when the rates are unknown.
 */
export function rolledSlotOdds(
  slot: number,
  previewed: readonly PreviewSlot[],
  slotRates: EnhancementReference['slots'],
): SlotOdds[] {
  const earlier = new Set(
    previewed
      .filter((other): other is PreviewBlessingSlot => other.kind === 'BLESSING' && other.slot < slot)
      .map((other) => other.blessingCode)
      .filter((code): code is string => code !== null),
  );
  const rates = (slotRates[slot - 1]?.rates ?? []).filter((rate) => !earlier.has(rate.blessingCode));
  const total = rates.reduce((sum, rate) => sum + rate.rate, 0);
  if (total <= 0) {
    return [];
  }
  return rates
    .map((rate) => ({ blessingCode: rate.blessingCode, probability: rate.rate / total }))
    .sort((a, b) => b.probability - a.probability);
}

/** The `{ equipment, quality }` pair to fetch `GET /enhancement-odds/reference` with, or null. */
export function buildReferenceParams(
  state: EnhancementFormState,
): { equipment: string, quality: number } | null {
  // Not `isPieceReady`: the rates don't depend on the grade, and the page only
  // refetches when this pair moves — so answering the grade can't be what
  // fetches them.
  if (state.equipment === null || state.quality === null) {
    return null;
  }
  return { equipment: state.equipment, quality: state.quality };
}

/**
 * Assembles the `POST /enhancement-odds` body from form state. Returns null
 * when the piece section isn't filled in yet — callers should already be
 * gating on {@link canCalculate} before this ever matters.
 *
 * Every occupied slot is sent — listing it is what says it holds a blessing —
 * with whatever of it the player transcribed. A value goes only with its
 * blessing, since alone it says nothing the API can use.
 *
 * A slot's refinement plan is only carried across when it's actually ready
 * (see {@link plannedRefineStoneQuality}) — `isRefined: true` is blocked and explained
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
    const slotState = state.slots[slot] ?? EMPTY_SLOT_FORM_STATE;
    const { blessingCode, value } = slotState;
    const transcribed = blessingCode !== null && value !== null;
    // A plan needs both halves (`isSlotBlessingRequired`/`isSlotValueRequired`
    // say so); this only keeps a half-filled row from sending one.
    const refineStoneQuality = transcribed ? plannedRefineStoneQuality(slotState) : null;
    slots.push({
      slot,
      ...(blessingCode !== null && { blessingCode }),
      ...(transcribed && { value }),
      ...(refineStoneQuality !== null && {
        isRefined: false,
        planRefineStoneQuality: refineStoneQuality,
      }),
    });
  }

  return {
    equipment: state.equipment!,
    quality: state.quality!,
    enhancementLevel: state.enhancementLevel,
    targetEnhancementLevel: state.targetEnhancementLevel,
    ...(state.initialGrade !== null && { initialGrade: state.initialGrade }),
    slots,
    targets: wishedTargets(state),
  };
}

/** Which of the piece's two moments a preview draws. */
export enum PreviewFace {
  /** The piece as the item screen shows it now, at the current level. */
  HAVE = 'HAVE',
  /** The piece once it reaches the target level, as far as the wishes describe it. */
  WANT = 'WANT',
}

/** A slot holding a blessing, on either face. */
export interface PreviewBlessingSlot {
  kind: 'BLESSING',
  slot: number,
  /** null while the player hasn't transcribed it yet — drawn as a blank, not an error. */
  blessingCode: string | null,
  /** The value shown now; null while not yet typed. */
  value: number | null,
  /**
   * The milestone that will boost this value on the way to the target level,
   * or null when nothing will touch it again. Only ever set on the WANT face.
   */
  boostedAt: number | null,
  /** The floor the player hopes the value reaches, when they named one. WANT face only. */
  minValue: number | null,
  /** The Refinement Stone the plan will apply here, by quality. WANT face only. */
  refineStoneQuality: number | null,
}

/** A slot nothing will have filled by the face's level. */
export interface PreviewEmptySlot {
  kind: 'EMPTY',
  slot: number,
  /** The milestone that would fill it — past the drawn level, by definition. */
  fillsAt: number,
}

/** An empty slot a milestone on the way to the target will fill. WANT face only. */
export interface PreviewWishSlot {
  kind: 'WISH',
  slot: number,
  /** The blessing hoped for, or null for "any". */
  blessingCode: string | null,
  /** The floor hoped for, or null for "any". */
  minValue: number | null,
  rollsAt: number,
}

export type PreviewSlot = PreviewBlessingSlot | PreviewEmptySlot | PreviewWishSlot;

function previewBlessingSlot(
  slot: number,
  slotState: SlotFormState,
  face: PreviewFace,
  boostedAt: number | null,
): PreviewBlessingSlot {
  return {
    kind: 'BLESSING',
    slot,
    blessingCode: slotState.blessingCode,
    value: slotState.value,
    boostedAt,
    // A floor only means something where a milestone can still move the number.
    minValue: boostedAt !== null ? slotState.heldWishMinValue : null,
    // A stone is applied on the way to the target, so it belongs to that face —
    // and unlike a wish it doesn't wait for a milestone.
    refineStoneQuality: face === PreviewFace.WANT ? plannedRefineStoneQuality(slotState) : null,
  };
}

/**
 * What each of the four slots looks like on one face of the piece — the model
 * behind the live preview cards, kept here so it is derived from the same
 * occupancy and wish rules the form itself runs on ({@link isSlotOccupied},
 * {@link slotWishState}) rather than from a second reading of them.
 *
 * The HAVE face is a straight transcription: occupied slots as typed, the rest
 * empty. The WANT face carries each slot forward to the target level: an
 * occupied slot keeps its blessing (a milestone only boosts the value), an
 * empty one a milestone will reach becomes a wish, and a slot the target never
 * reaches stays as it is.
 */
export function previewSlots(
  face: PreviewFace,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
): PreviewSlot[] {
  return Array.from({ length: MAX_BLESSING_SLOTS }, (_unused, index) => {
    const slot = index + 1;
    const slotState = slots[slot] ?? EMPTY_SLOT_FORM_STATE;
    const occupied = isSlotOccupied(slot, slots, shape);
    const milestone = milestoneForSlot(slot);

    if (face === PreviewFace.HAVE) {
      return occupied
        ? previewBlessingSlot(slot, slotState, face, null)
        : { kind: 'EMPTY', slot, fillsAt: milestone };
    }

    const wishState = slotWishState(slot, slots, shape);
    if (occupied) {
      const boostedAt = wishState === SlotWishState.VALUE_ONLY ? milestone : null;
      return previewBlessingSlot(slot, slotState, face, boostedAt);
    }
    if (wishState === SlotWishState.BLESSING_AND_VALUE) {
      return {
        kind: 'WISH',
        slot,
        blessingCode: slotState.wishBlessingCode,
        minValue: slotState.wishMinValue,
        rollsAt: milestone,
      };
    }
    return { kind: 'EMPTY', slot, fillsAt: milestone };
  });
}

/**
 * The grade a face's piece would be painted. The game colours an item by how
 * many blessings it shows — White for none, Green for one, up to Red for four
 * — so a milestone filling a slot turns the name a colour too. The WANT face
 * counts the slots its milestones will fill, whatever lands in them.
 */
export function previewGrade(previewed: PreviewSlot[]): number {
  const shown = previewed.filter((slot) => slot.kind !== 'EMPTY').length;
  return Math.min(shown + 1, 5);
}

/** Whether any milestone lies between the current and target levels. */
export function hasMilestoneAhead(shape: SlotShape): boolean {
  return MILESTONE_LEVELS.some(
    (milestone) => milestone > shape.enhancementLevel && milestone <= shape.targetEnhancementLevel,
  );
}
