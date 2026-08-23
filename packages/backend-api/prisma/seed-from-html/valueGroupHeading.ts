import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';

import { BlessingValueSelectorKind, ValueGroupSelector } from './blessingValueRates.models';

/**
 * Parses a "Drop Rates Related to Additional Blessings" value-table `<h2>` —
 * e.g. "Equipment Rank 1-5" or "Equipment Rank 6 (Librarian Rod, …)" — into a
 * {@link ValueGroupSelector}. Pure and catalog-driven: category names come from
 * `EQUIPMENT_CATEGORIES` directly (the same closed set every other category
 * match in this codebase uses), while `equipmentNames` is passed in because it
 * comes from the scrape rather than from `@shared`. See
 * docs/milestone-blessings.md, "The four value groups".
 */

const HEADING_PATTERN = /^Equipment Rank (\d+)(?:-(\d+))?(?:\s*\((.+)\))?$/;
const RANK_ORDER_INDICES = new Set(EQUIPMENT_RANKS.map((rank) => rank.orderIndex));
const CATEGORY_CODE_BY_NAME = new Map<string, string>(
  EQUIPMENT_CATEGORIES.map((category) => [category.name, category.code]),
);

export interface ValueGroupHeadingResult {
  /** The resolved selector. `code` has no numeric collision suffix — see `valueGroupHeading.ts`'s doc. */
  selector: ValueGroupSelector;
  /** Parenthetical tokens that matched neither a category nor an equipment name. */
  unknownTokens: string[];
}

/** SCREAMING_SNAKE_CASE of arbitrary text, for deriving a code from a heading we couldn't otherwise parse. */
export function toScreamingSnakeCase(text: string): string {
  return text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitTokens(parenthetical: string): string[] {
  return parenthetical
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Parses an "Equipment Rank …" `<h2>` into a selector. Classifies the
 * parenthetical in the order docs/milestone-blessings.md specifies: an
 * "Excluding…" fallback first, then an all-category match, then a
 * partial-or-full named-equipment match, then UNKNOWN. A heading that doesn't
 * even match the "Equipment Rank N[-M]" shape, or names a rank ordinal we
 * don't recognise, is also UNKNOWN — the caller decides whether that warrants
 * a hard failure (per docs/milestone-blessings.md's degradation ladder, it
 * doesn't: the rows still store, just unlinked from equipment).
 *
 * The **caller** appends a numeric suffix on a code collision (two distinct
 * headings deriving the same base code) — this function only sees one heading
 * at a time and has no way to know about its siblings.
 */
export function parseValueGroupHeading(
  headingText: string,
  equipmentNames: ReadonlySet<string>,
): ValueGroupHeadingResult {
  const match = HEADING_PATTERN.exec(headingText.trim());
  if (!match) {
    return {
      selector: {
        code: toScreamingSnakeCase(headingText),
        label: headingText,
        rankOrderMin: 0,
        rankOrderMax: 0,
        kind: BlessingValueSelectorKind.UNKNOWN,
        tokens: [],
      },
      unknownTokens: [],
    };
  }

  const min = parseInt(match[1]!, 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  const parenthetical = match[3];
  const baseCode = min === max ? `RANK_${min}` : `RANK_${min}_${max}`;

  if (!RANK_ORDER_INDICES.has(min) || !RANK_ORDER_INDICES.has(max)) {
    return {
      selector: {
        code: `${baseCode}_UNKNOWN`,
        label: headingText,
        rankOrderMin: min,
        rankOrderMax: max,
        kind: BlessingValueSelectorKind.UNKNOWN,
        tokens: parenthetical ? splitTokens(parenthetical) : [],
      },
      unknownTokens: [],
    };
  }

  if (!parenthetical) {
    return {
      selector: {
        code: baseCode,
        label: headingText,
        rankOrderMin: min,
        rankOrderMax: max,
        kind: BlessingValueSelectorKind.RANK_RANGE,
        tokens: [],
      },
      unknownTokens: [],
    };
  }

  if (/excluding/i.test(parenthetical)) {
    return {
      selector: {
        code: `${baseCode}_FALLBACK`,
        label: headingText,
        rankOrderMin: min,
        rankOrderMax: max,
        kind: BlessingValueSelectorKind.FALLBACK,
        tokens: [],
      },
      unknownTokens: [],
    };
  }

  const tokens = splitTokens(parenthetical);

  const categoryCodes = tokens.map((token) => CATEGORY_CODE_BY_NAME.get(token));
  if (categoryCodes.every((code): code is string => code !== undefined)) {
    return {
      selector: {
        code: `${baseCode}_CATEGORY`,
        label: headingText,
        rankOrderMin: min,
        rankOrderMax: max,
        kind: BlessingValueSelectorKind.CATEGORY,
        tokens: categoryCodes,
      },
      unknownTokens: [],
    };
  }

  const hasAtLeastOneKnownName = tokens.some((token) => equipmentNames.has(token));
  if (hasAtLeastOneKnownName) {
    return {
      selector: {
        code: `${baseCode}_NAMED`,
        label: headingText,
        rankOrderMin: min,
        rankOrderMax: max,
        kind: BlessingValueSelectorKind.NAMED,
        // The full list, verbatim — not filtered down to the names we currently
        // recognise. Unlike CATEGORY (a closed, stable vocabulary), an equipment
        // name not in our catalog *today* may still be a real piece we simply
        // haven't seeded (see `unknownTokens`): dropping it here would silently
        // un-publish membership the heading itself states, defeating the reason
        // this is scraped rather than hardcoded.
        tokens,
      },
      unknownTokens: tokens.filter((token) => !equipmentNames.has(token)),
    };
  }

  return {
    selector: {
      code: `${baseCode}_UNKNOWN`,
      label: headingText,
      rankOrderMin: min,
      rankOrderMax: max,
      kind: BlessingValueSelectorKind.UNKNOWN,
      tokens,
    },
    unknownTokens: tokens,
  };
}
