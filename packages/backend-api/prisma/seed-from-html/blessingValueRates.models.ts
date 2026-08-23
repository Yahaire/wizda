/**
 * Types produced by `blessingValueRates.parser.ts` — the "value" tables inside
 * `alternations.html`: what number a blessing lands on, rather than which
 * blessing lands (that's `equipmentBlessingDropRate.parser.ts`). See
 * docs/milestone-blessings.md for the model these feed.
 */

/**
 * How a `<h2>` value-group heading's parenthetical was classified. Ours, not
 * the source's — a new member here means new parsing code, unlike
 * `ValueGroupSelector.code`, which mirrors the source and can grow by data
 * alone. Mirrors the Prisma enum of the same name (Milestone 2).
 */
export enum BlessingValueSelectorKind {
  /** No parenthetical — the group is defined by rank range alone (e.g. "Equipment Rank 1-5"). */
  RANK_RANGE = 'RANK_RANGE',
  /** The parenthetical lists specific equipment names verbatim. */
  NAMED = 'NAMED',
  /** Every parenthetical token matches an `EquipmentCategory` name verbatim. */
  CATEGORY = 'CATEGORY',
  /** The parenthetical reads "Excluding weapons listed above" or similar. */
  FALLBACK = 'FALLBACK',
  /** The parenthetical didn't match any known shape — rates still store, unlinked. */
  UNKNOWN = 'UNKNOWN',
}

/** How one `<h2>` value-group heading resolves against our catalogs. */
export interface ValueGroupSelector {
  /** Stable derived code, e.g. "RANK_1_5", "RANK_6_NAMED". Never shown to players. */
  code: string;
  /** The verbatim heading text — kept for provenance, not for display. */
  label: string;
  /** `EquipmentRankInfo.orderIndex` lower bound this group covers (1-6; 0 if the heading didn't parse at all). */
  rankOrderMin: number;
  /** `EquipmentRankInfo.orderIndex` upper bound this group covers (1-6; 0 if the heading didn't parse at all). */
  rankOrderMax: number;
  kind: BlessingValueSelectorKind;
  /** Category codes (kind = CATEGORY), equipment names (kind = NAMED), or [] otherwise. */
  tokens: readonly string[];
}

/** One `<h1>` section, e.g. "DROP", "LFAS", "FAS". */
export interface ParsedValueSource {
  code: string;
  label: string;
  orderIndex: number;
}

/** One `<h2>` value group beneath a source section. */
export interface ParsedValueGroup {
  selector: ValueGroupSelector;
  orderIndex: number;
}

/** One cell of a value table. rate is always > 0 — impossible values aren't emitted. */
export interface ParsedValueRow {
  groupCode: string;
  sourceCode: string;
  /** 1-5. */
  quality: number;
  blessingCode: string;
  /** The number the blessing lands on. */
  value: number;
  /** P(value | group, source, quality, blessing), a fraction in (0, 1]. */
  rate: number;
}

/**
 * Unrecognised source values seen while parsing the value tables, mirroring
 * `TaxonomyDrift`'s "recorded, not thrown" contract (`equipmentTaxonomy.mapping.ts`).
 * Non-empty means a human should look, but every row still parses and stores.
 */
export interface BlessingValueDrift {
  /** `<h1>` headings that matched none of the known source patterns. */
  unknownSourceHeadings: string[];
  /** `<h2>` headings whose parenthetical classified as UNKNOWN. */
  unclassifiedGroupHeadings: string[];
  /** Parenthetical tokens that matched neither a category nor a known equipment name. */
  unknownSelectorTokens: string[];
  /** Row-label cells that didn't match the "<Stat> Increase (…)" grammar. */
  unknownBlessingLabels: string[];
}

/** Whether any drift at all was recorded — the trigger for the ACTION REQUIRED report. */
export function hasBlessingValueDrift(drift: BlessingValueDrift): boolean {
  return (
    drift.unknownSourceHeadings.length > 0
    || drift.unclassifiedGroupHeadings.length > 0
    || drift.unknownSelectorTokens.length > 0
    || drift.unknownBlessingLabels.length > 0
  );
}
