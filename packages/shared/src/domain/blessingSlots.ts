/**
 * A piece's four blessing slots: which milestone touches each, which of them
 * hold a blessing at a given point, and the without-replacement draw across
 * them. Shared by both oracles, and by the web client's slot editor.
 *
 * A piece's additional blessings don't stack, so its slots are drawn **without
 * replacement**: slot `s` draws from its own published row
 * (`EquipmentBlessingDropRate`, keyed by `(equipment, slot, blessing)`) with the
 * blessings earlier slots took removed and the survivors renormalised. That one
 * chain answers two different questions:
 *
 * - the Junk Oracle's *"what are the odds this piece carries ATK and SUR?"*
 *   (`blessingPresenceByGrade` in `dropRateMath.ts`)
 * - the Enhancement Oracle's *"which blessing will the next milestone put in the
 *   empty slot, given what's already on the piece?"* (`enhancementOdds` in
 *   `enhancementMath.ts`)
 *
 * so it lives here rather than inside either. Keep this module free of DB/HTTP
 * concerns — see `blessingSlots.test.ts`.
 */

/** A piece has four blessing slots; slot `n` is active from grade `n + 1`. */
export const MAX_BLESSING_SLOTS = 4;
/** A blessing slot is touched at +5, +10, +15 or +20 — slot `n` at `5n`. */
export const ENHANCEMENT_MILESTONE_STEP = 5;
/** Equipment enhances to +20, which is the last milestone (slot 4's). */
export const MAX_ENHANCEMENT_LEVEL = ENHANCEMENT_MILESTONE_STEP * MAX_BLESSING_SLOTS;

/** The enhancement level at which slot `slot` (1-based) is touched. */
export function milestoneForSlot(slot: number): number {
  return slot * ENHANCEMENT_MILESTONE_STEP;
}

/**
 * How many of a piece's slots hold a blessing: those occupied when it dropped
 * (slots `1 .. initialGrade − 1`, since grade counts blessings plus one) plus
 * those a passed milestone has filled (slots `1 .. level / 5`). Both are
 * prefixes filled top-to-bottom, so their union is one and its size is just the
 * larger — which is also why a piece's *current* grade is `1 + this`.
 *
 * Edge cases: clamps to {@link MAX_BLESSING_SLOTS}, so an over-large level or
 * grade can't produce a fifth slot.
 */
export function filledSlotCount(initialGrade: number, enhancementLevel: number): number {
  const occupiedAtDrop = initialGrade - 1;
  const milestonesPassed = Math.floor(enhancementLevel / ENHANCEMENT_MILESTONE_STEP);
  return Math.min(Math.max(occupiedAtDrop, milestonesPassed, 0), MAX_BLESSING_SLOTS);
}

/** Why a reported piece state can't be real. */
export enum SlotStateProblemKind {
  /** An empty slot with an occupied one after it — slots fill top-to-bottom. */
  GAP = 'GAP',
  /** A slot whose milestone has already passed, yet reported empty. */
  MISSING_MILESTONE_FILL = 'MISSING_MILESTONE_FILL',
  /** The stated grade at drop disagrees with how many slots are filled. */
  GRADE_MISMATCH = 'GRADE_MISMATCH',
}

export interface SlotStateProblem {
  kind: SlotStateProblemKind,
  /** The 1-based slot at fault, or null when the problem is about the piece. */
  slot: number | null,
  /** Plain-English explanation, safe to hand to an API client. */
  message: string,
}

/**
 * Whether a reported piece state is one the game can actually produce, or the
 * first reason it isn't.
 *
 * The rules all come from slots filling top-to-bottom: a slot holds a blessing
 * iff it was occupied at drop or its own milestone has passed, and both of those
 * are prefixes. So the filled slots are a prefix too, its length is
 * {@link filledSlotCount}, and any other shape is a mis-entry rather than an
 * exotic item.
 *
 * Edge cases: `initialGrade` null skips only the grade check — the prefix rules
 * still apply; `occupiedSlots` shorter than {@link MAX_BLESSING_SLOTS} treats the
 * missing tail as empty.
 */
export function checkBlessingSlotState(
  occupiedSlots: readonly boolean[],
  enhancementLevel: number,
  initialGrade: number | null,
): SlotStateProblem | null {
  const isOccupied = (slot: number): boolean => occupiedSlots[slot - 1] ?? false;

  let filled = 0;
  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    if (isOccupied(slot)) {
      filled++;
    }
  }

  for (let slot = 1; slot <= MAX_BLESSING_SLOTS; slot++) {
    if (isOccupied(slot)) {
      continue;
    }
    const occupiedAfter = [];
    for (let later = slot + 1; later <= MAX_BLESSING_SLOTS; later++) {
      if (isOccupied(later)) {
        occupiedAfter.push(later);
      }
    }
    if (occupiedAfter.length > 0) {
      return {
        kind: SlotStateProblemKind.GAP,
        slot,
        message: `Slot ${slot} is empty but slot ${occupiedAfter[0]} holds a blessing. `
          + 'Blessing slots fill top to bottom, so there can be no gap between them.',
      };
    }
    if (milestoneForSlot(slot) <= enhancementLevel) {
      return {
        kind: SlotStateProblemKind.MISSING_MILESTONE_FILL,
        slot,
        message: `Slot ${slot} is empty, but this piece is at +${enhancementLevel} and the `
          + `+${milestoneForSlot(slot)} milestone fills slot ${slot}. Every milestone reached `
          + 'either boosts that slot or puts a blessing in it.',
      };
    }
  }

  if (initialGrade !== null) {
    const expected = filledSlotCount(initialGrade, enhancementLevel);
    if (expected !== filled) {
      return {
        kind: SlotStateProblemKind.GRADE_MISMATCH,
        slot: null,
        message: `A grade ${initialGrade} piece at +${enhancementLevel} carries `
          + `${expected} ${expected === 1 ? 'blessing' : 'blessings'}, but `
          + `${filled} ${filled === 1 ? 'was' : 'were'} given. Grade at drop counts the `
          + 'blessings the piece came with; milestones fill the rest.',
      };
    }
  }

  return null;
}

/**
 * Enumerate every without-replacement assignment of blessings to `slots`,
 * calling `visit` once per assignment with its chain probability
 *
 * ```
 * P(b₁ … b_m) = Π_s  rate_s(b_s) / Σ_{x ∉ {b₁ … b_{s−1}}} rate_s(x)
 * ```
 *
 * `slots[s]` maps each blessing code to its published rate for slot `s+1`; only
 * nonzero entries need be present, and the denominator sums the *survivors*
 * rather than subtracting the taken ones from 1 — the published rows only sum to
 * 100% up to their own rounding.
 *
 * **`pinned[s]`** fixes slot `s` to an identity already known (the player told us
 * what's in it), leaving `null` slots to be enumerated. A pinned slot still
 * contributes its real chain factor rather than 1: a free slot earlier in the
 * chain can consume the very blessing a later pinned slot reports, and those
 * paths are impossible given what was observed. Callers conditioning on pinned
 * slots therefore need to divide by the total this produces — see
 * `enhancementOdds`. Pass an empty/all-null array to enumerate everything.
 *
 * **`mustCover`** prunes paths that can no longer cover every listed blessing, so
 * only covering assignments ever reach `visit`. Pass an empty set to visit them
 * all — which is what a caller accumulating per-slot marginals must do, since
 * the pruning would otherwise bias them.
 *
 * The `assignment` handed to `visit` is the walk's own working buffer, valid
 * only for the duration of the call — copy it if you need to keep it. That keeps
 * the Junk Oracle's path (which ignores it entirely) allocation-free.
 *
 * Edge cases: a pinned blessing that an earlier slot already took, or that the
 * slot cannot roll, contributes 0 and prunes that path; a slot with no rows, or
 * whose survivors sum to ≤ 0, likewise contributes 0; `mustCover` larger than
 * the slot count visits nothing.
 */
export function forEachSlotAssignment(
  slots: readonly ReadonlyMap<string, number>[],
  pinned: readonly (string | null)[],
  mustCover: ReadonlySet<string>,
  visit: (assignment: readonly string[], probability: number) => void,
): void {
  const taken = new Set<string>();
  const assignment = new Array<string>(slots.length);

  const walk = (slotIndex: number, chained: number, stillNeeded: number): void => {
    if (stillNeeded > slots.length - slotIndex) {
      return; // too few slots left to fit what's still required
    }
    if (slotIndex === slots.length) {
      visit(assignment, chained); // stillNeeded is 0 here, or the guard above returned
      return;
    }
    const slotRates = slots[slotIndex];
    if (!slotRates) {
      return; // an empty slot admits no assignment → this path contributes 0
    }

    // What this slot can still roll: its published row minus the blessings
    // earlier slots took. Sum the survivors rather than subtracting the taken
    // ones from 1 — the published rows only sum to 100% up to their rounding.
    let available = 0;
    for (const [blessing, rate] of slotRates) {
      if (rate > 0 && !taken.has(blessing)) {
        available += rate;
      }
    }
    if (available <= 0) {
      return; // nothing left for this slot to roll
    }

    const take = (blessing: string, rate: number): void => {
      taken.add(blessing);
      assignment[slotIndex] = blessing;
      walk(
        slotIndex + 1,
        (chained * rate) / available,
        stillNeeded - (mustCover.has(blessing) ? 1 : 0),
      );
      taken.delete(blessing);
    };

    const pinnedBlessing = pinned[slotIndex] ?? null;
    if (pinnedBlessing !== null) {
      const rate = slotRates.get(pinnedBlessing) ?? 0;
      if (rate > 0 && !taken.has(pinnedBlessing)) {
        take(pinnedBlessing, rate);
      }
      return; // a pinned slot has exactly one candidate, reachable or not
    }

    for (const [blessing, rate] of slotRates) {
      if (rate <= 0 || taken.has(blessing)) {
        continue;
      }
      take(blessing, rate);
    }
  };

  walk(0, 1, mustCover.size);
}
