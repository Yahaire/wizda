import * as cheerio from 'cheerio';

import { BLESSINGS } from '@shared/domain/stats';

import { parseBlessingLabel } from './blessingLabels';
import {
    BlessingValueDrift, BlessingValueSelectorKind, ParsedValueGroup, ParsedValueRow,
    ParsedValueSource
} from './blessingValueRates.models';
import { isCloseToOne, parsePercent } from './rateParsing';
import { parseValueGroupHeading, toScreamingSnakeCase } from './valueGroupHeading';

import type { Element } from 'domhandler';

/** Number of quality (★) levels a value table covers. Matches `RATE_LEVEL_COUNT` in `dropRateMath.ts`. */
const QUALITY_LEVEL_COUNT = 5;
/** 5 qualities x 19 blessings — a full value table's expected row count. */
const EXPECTED_ROWS_PER_TABLE = QUALITY_LEVEL_COUNT * BLESSINGS.length;

/**
 * Matches each `<h1>` to our source code. Order matters: "Lesser Full
 * Alteration" must be checked before the broader "Full Alteration", which it
 * would otherwise also match.
 */
const SOURCE_CODE_PATTERNS: readonly { pattern: RegExp, code: string }[] = [
  { pattern: /Lesser Full Alteration/i, code: 'LFAS' },
  { pattern: /Full Alteration/i, code: 'FAS' },
  { pattern: /Value Drop Rates by Equipment Rank/i, code: 'DROP' },
];

function resolveSourceCode(headingText: string): { code: string, matched: boolean } {
  for (const { pattern, code } of SOURCE_CODE_PATTERNS) {
    if (pattern.test(headingText)) {
      return { code, matched: true };
    }
  }
  return { code: toScreamingSnakeCase(headingText), matched: false };
}

/** Appends a numeric suffix until `baseCode` no longer collides, per `isTaken`. */
function uniqueCode(baseCode: string, isTaken: (candidate: string) => boolean): string {
  if (!isTaken(baseCode)) {
    return baseCode;
  }
  let suffix = 2;
  while (isTaken(`${baseCode}_${suffix}`)) {
    suffix++;
  }
  return `${baseCode}_${suffix}`;
}

/**
 * Checks whether `table`'s header matches a value table's shape — `Quality`,
 * `Additional Blessings`, then N strictly-increasing numeric columns — and, if
 * so, returns the value each column represents, read from the header text
 * (never the column index: column counts range 16-47 across the 12 tables, and
 * the first value column is 1, 2 or 3 depending on the section — see
 * docs/milestone-blessings.md). Returns `undefined` for anything else, which
 * is what lets the Alteration Stone "Example" table and the by-equipment table
 * pass through untouched.
 */
function tryGetTableValues($: cheerio.CheerioAPI, table: Element): number[] | undefined {
  const headers = $(table)
    .find('thead > tr')
    .eq(0)
    .find('> th')
    .toArray()
    .map((th) => $(th).text().trim());

  if (headers.length < 3 || headers[0] !== 'Quality' || headers[1] !== 'Additional Blessings') {
    return undefined;
  }

  const values: number[] = [];
  for (const header of headers.slice(2)) {
    const value = Number(header);
    if (header === '' || !Number.isInteger(value)) {
      return undefined;
    }
    if (values.length > 0 && value <= values[values.length - 1]!) {
      return undefined; // header values must be strictly increasing
    }
    values.push(value);
  }

  return values;
}

/** Sorted, deduplicated — so the same drifted value reported by many rows shows up once. */
function toSortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/**
 * Parses one value table's body into rows. Rowspan is read by cell count, the
 * same convention `equipmentBlessingDropRate.parser.ts` and
 * `dropRatesByJunk.parser.ts` use: a block-start row (new `Quality`) has one
 * more `<td>` than a continuation row. `-` means impossible and is simply not
 * emitted as a row.
 */
function parseValueTable(
  $: cheerio.CheerioAPI,
  table: Element,
  values: readonly number[],
  sourceCode: string,
  groupCode: string,
): { rows: ParsedValueRow[], unknownBlessingLabels: string[] } {
  const blockStartCellCount = values.length + 2;
  const continuationCellCount = values.length + 1;

  const rows: ParsedValueRow[] = [];
  const unknownBlessingLabels: string[] = [];
  let currentQuality = 0;
  let rowCount = 0;

  $(table)
    .find('tbody > tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('> td')
        .toArray()
        .map((td) => $(td).text());

      let labelText: string;
      let valueCells: string[];
      if (cells.length === blockStartCellCount) {
        const [qualityText, blessingLabel, ...rest] = cells;
        currentQuality = parseInt(qualityText!, 10);
        labelText = blessingLabel!;
        valueCells = rest;
      } else if (cells.length === continuationCellCount) {
        const [blessingLabel, ...rest] = cells;
        labelText = blessingLabel!;
        valueCells = rest;
      } else {
        throw new Error(
          `Unexpected value-table row shape (${sourceCode}/${groupCode}): ${cells.length} <td> cells `
          + `(expected ${blockStartCellCount} or ${continuationCellCount}).`,
        );
      }

      rowCount++;
      const blessingCode = parseBlessingLabel(labelText);
      if (blessingCode === null) {
        unknownBlessingLabels.push(labelText);
        return;
      }

      let rateSum = 0;
      valueCells.forEach((cellText, i) => {
        const rate = parsePercent(cellText);
        rateSum += rate;
        if (rate > 0) {
          rows.push({
            groupCode,
            sourceCode,
            quality: currentQuality,
            blessingCode,
            value: values[i]!,
            rate,
          });
        }
      });

      if (!isCloseToOne(rateSum)) {
        console.warn(
          `[parseBlessingValueRates] ${sourceCode}/${groupCode} quality ${currentQuality} "${labelText}" `
          + `rates sum to ${(rateSum * 100).toFixed(4)}%, expected ~100%.`,
        );
      }
    });

  if (rowCount !== EXPECTED_ROWS_PER_TABLE) {
    console.warn(
      `[parseBlessingValueRates] ${sourceCode}/${groupCode} has ${rowCount} row(s), expected `
      + `${EXPECTED_ROWS_PER_TABLE} (${QUALITY_LEVEL_COUNT} qualities x ${BLESSINGS.length} blessings).`,
    );
  }

  return { rows, unknownBlessingLabels };
}

export interface ParseBlessingValueRatesOptions {
  /** Equipment names known from "Additional Blessing Drop Rates by Equipment" — used to classify NAMED value groups. */
  equipmentNames: ReadonlySet<string>;
}

export interface ParseBlessingValueRatesResult {
  sources: ParsedValueSource[];
  groups: ParsedValueGroup[];
  rows: ParsedValueRow[];
  drift: BlessingValueDrift;
}

/**
 * Parses the 12 "value" tables inside "Drop Rates Related to Additional
 * Blessings" — what number a blessing lands on, rather than which blessing
 * lands (that's `equipmentBlessingDropRate.parser.ts`). See
 * docs/milestone-blessings.md for the model and the table layout.
 *
 * The source page mixes these in with two unrelated table shapes (an
 * Alteration Stone reroll example, and the by-equipment table), so — like the
 * other parsers in this folder — tables are matched by header shape (see
 * `tryGetTableValues`), never by heading text or position. `<h1>`/`<h2>` are
 * tracked by walking the document in order and inherited by whichever table
 * follows, the way `dropRatesByJunk.parser.ts` inherits its `<h2>`. A group's
 * `<h2>` heading text is memoised so the same heading appearing under all
 * three `<h1>` sections resolves to one group, not three.
 *
 * Drift degrades rather than fails: an unrecognised `<h1>` still stores its
 * rows under a derived source code, an unclassifiable `<h2>` still stores its
 * rows under an UNKNOWN group, and an unrecognised blessing label just skips
 * that one row (see {@link BlessingValueDrift}). The only hard failure is
 * finding no rows under the `DROP` source at all — nothing downstream is
 * computable without the base drop values.
 */
export function parseBlessingValueRates(
  html: string,
  { equipmentNames }: ParseBlessingValueRatesOptions,
): ParseBlessingValueRatesResult {
  const $ = cheerio.load(html);

  const sources = new Map<string, ParsedValueSource>();
  const sourceCodeByHeading = new Map<string, string>();
  const groups = new Map<string, ParsedValueGroup>();
  const groupCodeByHeading = new Map<string, string>();
  const rows: ParsedValueRow[] = [];

  const unknownSourceHeadings: string[] = [];
  const unclassifiedGroupHeadings: string[] = [];
  const unknownSelectorTokens: string[] = [];
  const unknownBlessingLabels: string[] = [];

  /**
   * Resolves and registers a source/group **lazily**, only when a heading
   * actually turns out to precede a matching value table — not eagerly on
   * every `<h1>`/`<h2>` the walk passes. The page has several unrelated
   * sections that use the same tags (the Alteration Stone example, the
   * by-equipment table), and eagerly registering every heading would both
   * pollute `sources`/`groups` with phantom entries that back zero rows and
   * misreport those unrelated headings as "unknown source" drift, when they
   * simply aren't part of this mechanism at all.
   */
  const resolveSource = (headingText: string): string => {
    let code = sourceCodeByHeading.get(headingText);
    if (code === undefined) {
      const resolved = resolveSourceCode(headingText);
      if (!resolved.matched) {
        unknownSourceHeadings.push(headingText);
      }
      code = uniqueCode(resolved.code, (candidate) => sources.has(candidate));
      sources.set(code, { code, label: headingText, orderIndex: sources.size });
      sourceCodeByHeading.set(headingText, code);
    }
    return code;
  };

  const resolveGroup = (headingText: string): string => {
    let code = groupCodeByHeading.get(headingText);
    if (code === undefined) {
      const { selector, unknownTokens } = parseValueGroupHeading(headingText, equipmentNames);
      unknownSelectorTokens.push(...unknownTokens);
      if (selector.kind === BlessingValueSelectorKind.UNKNOWN) {
        unclassifiedGroupHeadings.push(headingText);
      }
      code = uniqueCode(selector.code, (candidate) => groups.has(candidate));
      groups.set(code, { selector: { ...selector, code }, orderIndex: groups.size });
      groupCodeByHeading.set(headingText, code);
    }
    return code;
  };

  let pendingSourceHeading: string | undefined;
  let pendingGroupHeading: string | undefined;

  const sections = $('h1, h2, table').toArray() as Element[];
  for (const section of sections) {
    if (section.name === 'h1') {
      pendingSourceHeading = $(section).text().trim();
      pendingGroupHeading = undefined;
      continue;
    }

    if (section.name === 'h2') {
      pendingGroupHeading = $(section).text().trim();
      continue;
    }

    // section.name === 'table'
    const values = tryGetTableValues($, section);
    if (values === undefined) {
      continue; // not a value table — the Alteration example or the by-equipment table
    }
    if (pendingSourceHeading === undefined || pendingGroupHeading === undefined) {
      throw new Error('Found a value table with no preceding <h1>/<h2> — the document structure has changed.');
    }

    const sourceCode = resolveSource(pendingSourceHeading);
    const groupCode = resolveGroup(pendingGroupHeading);

    const { rows: tableRows, unknownBlessingLabels: tableUnknownLabels } = parseValueTable(
      $,
      section,
      values,
      sourceCode,
      groupCode,
    );
    rows.push(...tableRows);
    unknownBlessingLabels.push(...tableUnknownLabels);
  }

  if (!rows.some((row) => row.sourceCode === 'DROP')) {
    throw new Error(
      'Found no rows under "Additional Blessing Value Drop Rates by Equipment Rank" (source DROP) — '
      + 'nothing is computable without the base drop values.',
    );
  }

  return {
    sources: [...sources.values()],
    groups: [...groups.values()],
    rows,
    drift: {
      unknownSourceHeadings: toSortedUnique(unknownSourceHeadings),
      unclassifiedGroupHeadings: toSortedUnique(unclassifiedGroupHeadings),
      unknownSelectorTokens: toSortedUnique(unknownSelectorTokens),
      unknownBlessingLabels: toSortedUnique(unknownBlessingLabels),
    },
  };
}
