/**
 * The three published blessing-value tables, by the **role** they play rather
 * than by the code they happen to be stored under.
 *
 * `BlessingValueSource.code` is *derived from the source page's `<h1>` text* by
 * `blessingValueRates.parser.ts` — which is why it's a lookup table rather than
 * an enum (the devs have added `<h1>` sections before, and can again; see
 * docs/domain.md). That makes the code a scrape artefact: a reword upstream
 * could change it. So the API keys its payloads by the role names below and
 * resolves them through this map, exactly as `docs/milestone-blessings.md`'s
 * plan keeps derived group codes out of shared URLs.
 */

/** What a value table describes, independent of how its heading is worded. */
export enum BlessingValueSourceRole {
  /** The value a blessing has when the equipment is obtained from junk. */
  DROP = 'drop',
  /** The value after a Lesser Full Alteration Stone — `drop ⊛ bonus`. */
  LESSER_FAS = 'lesserFas',
  /** The value after a Full Alteration Stone — `drop ⊛ bonus ⊛ bonus`. */
  FAS = 'fas',
}

/**
 * The stored `BlessingValueSource.code` for each role. The single place these
 * literals live: the parser derives codes to match, and the API resolves back
 * through here, so a heading reword is a one-line change rather than a hunt.
 */
export const BLESSING_VALUE_SOURCE_CODES: Readonly<Record<BlessingValueSourceRole, string>> = {
  [BlessingValueSourceRole.DROP]: 'DROP',
  [BlessingValueSourceRole.LESSER_FAS]: 'LFAS',
  [BlessingValueSourceRole.FAS]: 'FAS',
};
