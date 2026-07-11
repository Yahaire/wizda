import { wizdaLinesEn } from './voice.en';

/**
 * The shape of Wizda's voice — every player-facing line she "says", in one place.
 * See `docs/wizda-voice.md` for who she is and how the lines should read.
 *
 * A translation is a parallel object of this exact shape (e.g. a future
 * `voice.es.ts`); only the {@link wizda} binding at the bottom points at the
 * active locale, so switching languages is a one-line change here. `satisfies`
 * on each locale object makes a missing or mistyped entry a compile error.
 *
 * Static lines are strings. Lines that interpolate computed values (blessing
 * labels, grade names) are functions taking the already-formatted pieces — the
 * catalog owns the *sentence*, the caller owns the *values plugged in*.
 */
export interface WizdaLines {
  readonly greet: {
    /** Shown once, ever, on a visitor's first arrival. */
    readonly welcome: string,
    /** Playful, Wizardry-lore-flavoured lines — one shown per day on first open. */
    readonly daily: readonly string[],
  },
  readonly oracle: {
    /** One-line, in-character intro for the Junk Oracle (and its menu tooltip). */
    readonly tagline: string,
    /** Nudge when the player asks for everything at once (also the NO_QUERY error). */
    readonly snark: string,
    /** Reality check when the certainty slider is cranked to its cap. */
    readonly agoraLine: string,
    readonly loadError: string,
    readonly emptyPrompt: string,
    /** The one assumption behind blessing-filtered results. */
    readonly estimateNote: string,
    readonly estimateNoteLink: string,
    readonly endOfList: string,
    readonly noResults: string,
    readonly blessingsHelp: string,
    /** Plain-language help shown in each filter's info modal (the ⓘ next to the label). */
    readonly filterHelp: {
      readonly equipment: string,
      readonly quality: string,
      readonly grade: string,
      readonly blessings: string,
      readonly category: string,
      readonly rank: string,
      readonly certainty: string,
    },
  },
  readonly errors: {
    readonly unknownEquipment: string,
    readonly unknownBlessing: string,
    readonly generic: string,
  },
  /**
   * The full-screen takeover shown while the backend is down for a reseed
   * (see MaintenanceGate). We never say "maintenance" to the player — she's
   * just stepped out for a bit.
   */
  readonly away: {
    /** Shown under the floating fairy while she's gone. */
    readonly title: string,
    /** Shown briefly, with a welcoming rise-and-grow, right before the page reloads. */
    readonly back: string,
  },
  readonly about: {
    readonly intro: string,
  },
  readonly credits: {
    readonly thanks: string,
  },
  /** The data-freshness label + toast: when the DB was last (re)seeded. */
  readonly data: {
    /** Her spoken line. `age` is a relative phrase like "2 hours ago". */
    readonly freshness: (age: string) => string,
    /** The plain, muted footnote under her line (factual register, not her voice). */
    readonly freshnessNote: (age: string) => string,
    /** Cheeky flourish appended to her line only when the update is under a day old. */
    readonly freshInk: string,
  },
  /** The reactive-cleanup confirm: its buttons, and the reasons a selection can't stand. */
  readonly confirm: {
    readonly tidyLabel: string,
    readonly leaveLabel: string,
    /** The identity axes (gear × category × rank) name nothing all three at once. */
    readonly identityNoOverlap: string,
    /** A contradiction we can name the shape of, but not the single fix for. */
    readonly genericConflict: string,
    /** One required blessing nothing in play can roll. `labels` is the "or"-joined name. */
    readonly blessingUnrollableOne: (labels: string) => string,
    /** Several required blessings none of which anything rolls. */
    readonly blessingUnrollableMany: (labels: string) => string,
    /** Each blessing rolls somewhere, but no single piece carries all of them. */
    readonly blessingComboUnrollable: (labels: string) => string,
    /** "3 blessings need Purple or better" — the grade floor, said out loud. */
    readonly blessingFloorPhrase: (
      count: number,
      gradeName: string,
      atMax: boolean,
    ) => string,
    /** The blessing floor sits above what the gear ever drops. */
    readonly gradeFloorTooHigh: (floorPhrase: string) => string,
    readonly gradeTooHigh: (gradeName: string) => string,
    readonly qualityTooHigh: (qualityLabel: string) => string,
  },
}

/** The active locale. Swap this binding to switch languages once more exist. */
export const wizda: WizdaLines = wizdaLinesEn;
