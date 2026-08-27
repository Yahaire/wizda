/**
 * Request/response contract for the Enhancement Oracle — *"if I enhance this
 * piece, what are the odds the blessings I care about end up at the numbers I
 * want?"*. Pure types shared by the backend (which produces them) and the
 * web-client (which consumes them). The math is in
 * `packages/shared/src/domain/enhancementMath.ts`; see
 * `docs/calculation/enhancement.md`, and `docs/milestone-blessings.md` +
 * `docs/stones.md` for the game model behind it.
 *
 * Sibling of `junkToGuarantee.models.ts`, and the same conventions apply:
 * equipment is addressed by its English `name` (the stable public key), a
 * `displayName` rides alongside for the request's locale, and blessings are
 * addressed by `code` from the shared `BLESSINGS` catalog.
 */

import { ValueDistribution } from '../../domain/enhancementMath';
import { TsUtilities } from '../../tsUtilities';

/** Where a piece is taken by default when a query doesn't say — the last milestone. */
export const DEFAULT_TARGET_ENHANCEMENT_LEVEL = 20;

/**
 * One blessing slot exactly as the item screen shows it.
 *
 * Deliberately *only* what the player can read off their gear. What produced the
 * number — the drop roll, an Alteration Stone, a Refinement Stone, a Full
 * Alteration Stone, a bonus already collected — is already summed into `value`,
 * and does not affect what enhancing will add. See
 * `docs/calculation/enhancement.md`, "Why history isn't asked for".
 */
export interface EnhancementSlotState {
  /** 1-4. Slots fill top-to-bottom; slot `n` is touched at +5`n`. */
  slot: number,
  /**
   * The blessing in this slot, by code. Omit for a slot that is still empty.
   * Two slots **may** carry the same blessing — alteration can put a duplicate
   * on a piece, and a later milestone can roll one in.
   */
  blessingCode?: string,
  /** The number displayed for that blessing. Required whenever `blessingCode` is set. */
  value?: number,
  /**
   * Whether this slot already carries a Refinement Stone. Ignored unless
   * `planRefineStoneQuality` is set — and **required** when it is, because a new
   * stone replaces an existing refinement rather than adding to it, so the two
   * cases have different answers and neither the value alone nor a guess can
   * settle which applies.
   */
  isRefined?: boolean,
  /**
   * ★1-5 of a Refinement Stone the player is *considering* for this slot, added
   * on top of everything else. The star rating is the **stone's**, never the
   * gear's: extraction can yield a stone up to two tiers above the piece it came
   * from (docs/stones.md), so it is always a player input.
   *
   * Requires {@link isRefined}, and is rejected with `ALREADY_REFINED` when that
   * is true (or when `value` is above anything reachable unrefined): answering
   * needs the existing refinement subtracted out of `value` first, which needs
   * the value's own composition. Not supported yet — see
   * docs/calculation/enhancement.md.
   */
  planRefineStoneQuality?: number,
}

/**
 * One thing the player wants to end up with. Targets are **ANDed**, and each is
 * satisfied by a *distinct* slot — asking for `ATK ≥ 16` and `ATK ≥ 8` wants two
 * ATK slots, not one good one counted twice.
 *
 * Modelled as a list of predicates rather than a map keyed by blessing so that
 * a future "at most" bound is purely additive.
 */
export interface EnhancementTarget {
  /** Blessing code from the shared `BLESSINGS` catalog. An unknown code is a 400. */
  blessingCode: string,
  /** Inclusive floor. Omitted means "any value — I just want this blessing". */
  minValue?: number,
}

/** Body of `POST /enhancement-odds`. */
export interface EnhancementOddsQuery {
  /** The piece, by **name** (the public key — see `GuaranteeFilters.equipment`). */
  equipment: string,
  /** The piece's quality (★), 1-5. */
  quality: number,
  /** Where the piece is now, 0-20. */
  enhancementLevel: number,
  /**
   * How far the player intends to take it, 0-20; must be at least
   * `enhancementLevel`. Defaults to {@link DEFAULT_TARGET_ENHANCEMENT_LEVEL}.
   * Milestones beyond it never fire, so slots they would have filled stay empty
   * — which is what makes *"is +15 enough?"* answerable.
   */
  targetEnhancementLevel?: number,
  /**
   * The piece's grade **when it dropped**, 1-5 (White…Red) — not its grade now,
   * which rises as milestones fill slots. Optional, and it does **not** change
   * the odds: everything the calculation needs is fixed by the current per-slot
   * state. It is used to cross-check that state (a grade `g` piece at +`n`
   * carries `max(g − 1, n / 5)` blessings) and, on the client, to tell a
   * milestone-filled slot from one occupied at drop when labelling values.
   */
  initialGrade?: number,
  /**
   * The one slot whose blessing was swapped by an Alteration Stone, 1-4.
   *
   * This is not bookkeeping. A milestone fill avoids the piece's **initial**
   * blessings, and a standard Alteration Stone's result is not one of them — it
   * overwrites what a slot displays without joining that set, and without
   * removing the blessing it replaced from it. So a later milestone can roll the
   * very blessing an altered slot shows, and whether we know a slot was altered
   * is the difference between a second copy being possible and impossible.
   *
   * A Lesser or Full Alteration Stone needs no declaring: it re-rolls every
   * blessing on the piece, so afterwards the displayed blessings *are* the
   * initial ones and any prior alteration has been wiped. At most one slot is
   * ever altered, for the same reason (docs/stones.md).
   */
  alteredSlot?: number,
  /**
   * What {@link alteredSlot} originally rolled, if the player remembers — the
   * blessing later milestones will avoid, *not* the one the slot displays. Omit
   * to average over the possibilities.
   */
  alteredFrom?: string,
  /** The piece's four slots. Omitted slots are treated as empty. */
  slots: EnhancementSlotState[],
  /** At least one; an empty list is a 400 (there'd be nothing to compute). */
  targets: EnhancementTarget[],
}

/**
 * *How the model works* — stable, and never a warning badge. These say what the
 * calculation assumed, not that anything is wrong with it. The web client
 * renders them in the mascot's voice inside the "how we got this" panel; the
 * strings here are neutral wording for API consumers.
 */
export enum EnhancementNoteCode {
  /**
   * The rule for what a milestone puts in an **empty** slot is the one number on
   * the site that isn't traceable to a published table — it comes from our own
   * in-game testing.
   */
  EMPTY_SLOT_RULE_EMPIRICAL = 'EMPTY_SLOT_RULE_EMPIRICAL',
  /** That rule was proved for slot 1 and is assumed to hold for slots 2-4. */
  LATER_SLOTS_ASSUMED = 'LATER_SLOTS_ASSUMED',
  /** A milestone avoids the piece's initial blessings, so it can duplicate an altered slot. */
  NO_STACK_ON_ORIGINALS = 'NO_STACK_ON_ORIGINALS',
  /** The altered slot's original blessing wasn't given, so the answer averages over it. */
  ALTERED_ORIGIN_UNKNOWN = 'ALTERED_ORIGIN_UNKNOWN',
}

/**
 * *Our data is incomplete right now* — temporary, and worth flagging in the
 * result the way the Junk Oracle flags a blessing estimate. Distinct from
 * {@link EnhancementNoteCode}: conflating the two is what would make this tool
 * read as less trustworthy than it is.
 */
export enum EnhancementWarningCode {
  /** No value group resolved for this piece, so no value table applies to it. */
  NO_VALUE_GROUP = 'NO_VALUE_GROUP',
  /** A milestone bonus in play failed its reconvolution check at seed time. */
  UNVERIFIED_BONUS = 'UNVERIFIED_BONUS',
  /** The piece has no per-slot blessing rates, so a milestone's draw is unknown. */
  NO_BLESSING_RATES = 'NO_BLESSING_RATES',
  /** A value distribution the calculation needed is missing from the data. */
  MISSING_VALUE_DATA = 'MISSING_VALUE_DATA',
}

/** Neutral wording for each note, for API consumers. See {@link EnhancementNoteCode}. */
export const ENHANCEMENT_NOTES: Readonly<Record<EnhancementNoteCode, string>> = {
  [EnhancementNoteCode.EMPTY_SLOT_RULE_EMPIRICAL]: TsUtilities.stringJoin([
    "A milestone that fills an empty slot gives it a plain drop-value roll with no",
    "enhancement bonus on top. The official tables don't cover this case; the rule",
    "comes from our own in-game testing.",
  ]),
  [EnhancementNoteCode.LATER_SLOTS_ASSUMED]: TsUtilities.stringJoin([
    "That empty-slot rule was tested on slot 1 and is assumed to hold for slots 2",
    "to 4. The source publishes one value table per blessing with no slot axis, and",
    "the game describes all four milestones identically.",
  ]),
  [EnhancementNoteCode.NO_STACK_ON_ORIGINALS]: TsUtilities.stringJoin([
    "A milestone won't repeat a blessing the piece originally rolled, but an",
    "Alteration Stone's result doesn't count as one of those — so a later milestone",
    "can land on the blessing an altered slot displays, giving the piece two of it.",
  ]),
  [EnhancementNoteCode.ALTERED_ORIGIN_UNKNOWN]: TsUtilities.stringJoin([
    "The altered slot's original blessing wasn't given, so this averages over every",
    "blessing it could have been. Supplying it makes the answer exact.",
  ]),
};

/** Neutral wording for each warning. See {@link EnhancementWarningCode}. */
export const ENHANCEMENT_WARNINGS: Readonly<Record<EnhancementWarningCode, string>> = {
  [EnhancementWarningCode.NO_VALUE_GROUP]: TsUtilities.stringJoin([
    "We don't know which blessing-value table this piece rolls on, so we can't say",
    "what its blessings are worth.",
  ]),
  [EnhancementWarningCode.UNVERIFIED_BONUS]: TsUtilities.stringJoin([
    "The enhancement bonus used here didn't reproduce the published alteration-stone",
    "tables exactly when it was last checked, so treat the numbers as provisional.",
  ]),
  [EnhancementWarningCode.NO_BLESSING_RATES]: TsUtilities.stringJoin([
    "We have no per-slot blessing rates for this piece, so we can't say which",
    "blessing a milestone would put in an empty slot.",
  ]),
  [EnhancementWarningCode.MISSING_VALUE_DATA]: TsUtilities.stringJoin([
    "Some of the value data this answer needs is missing, so no probability is given.",
  ]),
};

/** One blessing a milestone could drop into an empty slot, and what it'd be worth. */
export interface EnhancementSlotCandidate {
  blessingCode: string,
  /** P(this blessing lands here), conditioned on the rest of the piece. */
  probability: number,
  valueDistribution: ValueDistribution,
}

/** What one slot will look like once the piece reaches `targetEnhancementLevel`. */
export interface EnhancementSlotOutcome {
  slot: number,
  /** True when nothing further will be rolled into this slot. */
  isFinal: boolean,
  /** The blessing the slot holds, or absent while a milestone has yet to fill it. */
  blessingCode?: string,
  /**
   * The slot's final value distribution — a single-point distribution when
   * {@link isFinal}. Absent for a slot still waiting to be filled; see
   * {@link candidates}.
   */
  valueDistribution?: ValueDistribution,
  /**
   * What a milestone might put here, best odds first. Present only for a slot a
   * remaining milestone will fill. Returned in full so the client can move a
   * target threshold and re-score locally, with no round trip.
   */
  candidates?: EnhancementSlotCandidate[],
}

/** Response of `POST /enhancement-odds`. */
export interface EnhancementOddsResult {
  /** The piece's `@unique` name — the public key, echoed back. */
  equipment: string,
  /** `equipment` resolved to the request's locale. Display-only; never send it back. */
  equipmentDisplayName: string,
  /**
   * P(every target met), or `null` when data the answer needed is missing — in
   * which case {@link warnings} says which. Never a number computed on gaps.
   */
  probability: number | null,
  /**
   * Which blessing-value table this piece rolls on, or null if none resolved.
   * **Internal**: the stored label is a verbatim English heading and is not fit
   * to show a player. Present for debugging and for the client to detect the
   * no-data case.
   */
  valueGroupCode: string | null,
  /** The milestones between now and the target level, ascending — e.g. `[15, 20]`. */
  remainingMilestones: number[],
  /** All four slots, in order. */
  slots: EnhancementSlotOutcome[],
  /** How the model works. Always safe to show; never a warning. */
  notes: EnhancementNoteCode[],
  /** Where our data is thin. Worth flagging in the result. */
  warnings: EnhancementWarningCode[],
}

/** One blessing's published value bands for a given piece and quality. */
export interface EnhancementBlessingReference {
  blessingCode: string,
  /** The value at drop. Null when the piece has no value group or no rows. */
  drop: ValueDistribution | null,
  /** The value after a Lesser Full Alteration Stone — `drop ⊛ bonus`. */
  lesserFas: ValueDistribution | null,
  /** The value after a Full Alteration Stone — `drop ⊛ bonus ⊛ bonus`. */
  fas: ValueDistribution | null,
  /** The derived milestone bonus, and whether it reconvolved cleanly at seed time. */
  bonus: (ValueDistribution & { isVerified: boolean }) | null,
}

/** One slot's blessing-identity odds for a given piece. */
export interface EnhancementSlotReference {
  slot: number,
  /** Only nonzero rates; per slot they sum to 1. */
  rates: { blessingCode: string, rate: number }[],
  /**
   * True when this slot always rolls the same blessing — a single rate of 1.0.
   * Some pieces have fixed blessing types (the 4★ class rings, the FFXI collab
   * Relics, the Battlefront Arena Heavy Warblade of Honor on its first two slots
   * only), so this is per slot rather than per piece. See docs/stones.md.
   */
  isFixed: boolean,
}

/**
 * Response of `GET /enhancement-odds/reference`. Everything the client needs to
 * bound a value input and label which band a typed number came from, **before**
 * any odds query exists — so it is fetched once per (equipment, quality) rather
 * than per keystroke or per blessing.
 *
 * Alteration/Refinement Stone ranges are deliberately absent: they're static
 * reference data the client already has, in `@shared/domain/stoneValues`.
 */
export interface EnhancementReference {
  equipment: string,
  /** See {@link EnhancementOddsResult.equipmentDisplayName}. */
  equipmentDisplayName: string,
  quality: number,
  /** See {@link EnhancementOddsResult.valueGroupCode} — internal, not a label. */
  valueGroupCode: string | null,
  /** One entry per blessing in the shared catalog, in catalog order. */
  blessings: EnhancementBlessingReference[],
  /** One entry per slot, 1-4. */
  slots: EnhancementSlotReference[],
  warnings: EnhancementWarningCode[],
}
