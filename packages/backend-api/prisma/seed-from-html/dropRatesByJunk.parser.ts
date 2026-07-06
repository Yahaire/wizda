import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { FiveTierRates, ParsedJunkDropRow } from './dropRatesByJunk.models';

const EXPECTED_HEADER_ROW_1 = [
  'Group Number',
  'Drop Rates',
  'Equipment',
  'Drop Rates',
  'Quality Drop Rates',
  'Grade Drop Rates',
];
const EXPECTED_HEADER_ROW_2 = ['★1', '★2', '★3', '★4', '★5', '1', '2', '3', '4', '5'];

/** Row that starts a new group: group number + group rate + equipment + item rate + 5 quality + 5 grade. */
const GROUP_START_CELL_COUNT = 14;
/** Row that continues the current group: equipment + item rate + 5 quality + 5 grade. */
const GROUP_CONTINUATION_CELL_COUNT = 12;

/** Fraction sums are allowed to drift this much from 1 before we warn (source rounding). */
const SUM_TOLERANCE = 0.005;

function parsePercent(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '-') {
    return 0;
  }
  return parseFloat(trimmed.replace('%', '')) / 100;
}

function getHeaderRowTexts($: cheerio.CheerioAPI, table: Element, rowIndex: number): string[] {
  return $(table)
    .find('thead > tr')
    .eq(rowIndex)
    .find('> th')
    .toArray()
    .map((th) => $(th).text().trim());
}

function validateHeader($: cheerio.CheerioAPI, table: Element, junkName: string): void {
  const row1 = getHeaderRowTexts($, table, 0);
  const row2 = getHeaderRowTexts($, table, 1);

  const matches =
    row1.length === EXPECTED_HEADER_ROW_1.length
    && row1.every((text, i) => text === EXPECTED_HEADER_ROW_1[i])
    && row2.length === EXPECTED_HEADER_ROW_2.length
    && row2.every((text, i) => text === EXPECTED_HEADER_ROW_2[i]);

  if (!matches) {
    throw new Error(
      `Unexpected table header for junk "${junkName}". `
      + `Row 1: ${JSON.stringify(row1)}, Row 2: ${JSON.stringify(row2)}`,
    );
  }
}

/** `itemCells` is always [equipment, itemRate, ★1-5, grade1-5] — 12 cells, checked by the caller. */
function buildRow(
  junkName: string,
  groupNumber: number,
  groupDropRate: number,
  itemCells: string[],
): ParsedJunkDropRow {
  const [equipmentName, dropRateText, ...rates] = itemCells;
  const qualityRates = rates.slice(0, 5).map(parsePercent) as FiveTierRates;
  const gradeRates = rates.slice(5, 10).map(parsePercent) as FiveTierRates;

  return {
    junkName,
    groupNumber,
    groupDropRate,
    equipmentName: equipmentName!.trim(),
    dropRate: parsePercent(dropRateText!),
    qualityRates,
    gradeRates,
  };
}

function parseJunkTable($: cheerio.CheerioAPI, table: Element, junkName: string): ParsedJunkDropRow[] {
  const rows: ParsedJunkDropRow[] = [];
  let currentGroupNumber = 0;
  let currentGroupDropRate = 0;

  $(table)
    .find('tbody > tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('> td')
        .toArray()
        .map((td) => $(td).text());

      if (cells.length === GROUP_START_CELL_COUNT) {
        const [groupNumberText, groupRateText, ...itemCells] = cells;
        currentGroupNumber = parseInt(groupNumberText!, 10);
        currentGroupDropRate = parsePercent(groupRateText!);
        rows.push(buildRow(junkName, currentGroupNumber, currentGroupDropRate, itemCells));
      } else if (cells.length === GROUP_CONTINUATION_CELL_COUNT) {
        rows.push(buildRow(junkName, currentGroupNumber, currentGroupDropRate, cells));
      } else {
        throw new Error(
          `Unexpected row shape in junk "${junkName}": ${cells.length} <td> cells (expected `
          + `${GROUP_START_CELL_COUNT} or ${GROUP_CONTINUATION_CELL_COUNT}).`,
        );
      }
    });

  return rows;
}

function isCloseToOne(sum: number): boolean {
  return Math.abs(sum - 1) <= SUM_TOLERANCE;
}

/**
 * Non-fatal sanity checks on the parsed rows, per docs/domain.md's note that
 * group/item rates are "kept for provenance and data-quality checks". Logs a
 * warning rather than throwing — a bad parse can be checked manually in the
 * DB afterward.
 */
function warnOnSuspiciousTotals(rows: ParsedJunkDropRow[]): void {
  for (const row of rows) {
    const qualitySum = row.qualityRates.reduce((a, b) => a + b, 0);
    const gradeSum = row.gradeRates.reduce((a, b) => a + b, 0);
    if (!isCloseToOne(qualitySum)) {
      console.warn(
        `[parseDropRatesByJunk] "${row.equipmentName}" (${row.junkName}) quality rates sum to `
        + `${(qualitySum * 100).toFixed(4)}%, expected ~100%.`,
      );
    }
    if (!isCloseToOne(gradeSum)) {
      console.warn(
        `[parseDropRatesByJunk] "${row.equipmentName}" (${row.junkName}) grade rates sum to `
        + `${(gradeSum * 100).toFixed(4)}%, expected ~100%.`,
      );
    }
  }

  // Keyed by junkName, then by groupNumber — junk names may contain spaces, so a
  // string-concatenated key would be ambiguous to split back apart.
  const groupItemRateSums = new Map<string, Map<number, number>>();
  const junkGroupRates = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const itemSums = groupItemRateSums.get(row.junkName) ?? new Map<number, number>();
    itemSums.set(row.groupNumber, (itemSums.get(row.groupNumber) ?? 0) + row.dropRate);
    groupItemRateSums.set(row.junkName, itemSums);

    const groupRatesForJunk = junkGroupRates.get(row.junkName) ?? new Map<number, number>();
    groupRatesForJunk.set(row.groupNumber, row.groupDropRate);
    junkGroupRates.set(row.junkName, groupRatesForJunk);
  }

  for (const [junkName, itemSums] of groupItemRateSums) {
    for (const [groupNumber, sum] of itemSums) {
      if (!isCloseToOne(sum)) {
        console.warn(
          `[parseDropRatesByJunk] "${junkName}" group ${groupNumber} item rates sum to `
          + `${(sum * 100).toFixed(4)}%, expected ~100%.`,
        );
      }
    }
  }

  for (const [junkName, groupRates] of junkGroupRates) {
    const sum = [...groupRates.values()].reduce((a, b) => a + b, 0);
    if (!isCloseToOne(sum)) {
      console.warn(
        `[parseDropRatesByJunk] "${junkName}" group rates sum to ${(sum * 100).toFixed(4)}%, `
        + 'expected ~100%.',
      );
    }
  }
}

export interface ParseDropRatesByJunkResult {
  rows: ParsedJunkDropRow[];
  /** Junk names whose `<h2>`/`<table>` section appeared more than once — see `parseDropRatesByJunk`. */
  junksWithMultiplePools: Set<string>;
}

/**
 * Parses the "Drop Rates by Junk" page into one row per (junk, group, equipment).
 *
 * The source page has occasionally been observed to list the same junk name's
 * `<h2>`/`<table>` section twice, with a different item list each time (e.g.
 * likely tied to an in-game milestone — such as ascending a dungeon — that
 * changes a pool's contents). Treating both as concurrently live would
 * double-count that group's rates (summing to ~200%), so on a repeat `<h2>` we
 * keep only the later occurrence and log a warning naming the junk. The junk
 * name is also returned in `junksWithMultiplePools` so the seed can flag it
 * (`Junk.hasMultiplePools`) for the frontend to surface as a caveat, since the
 * discarded version may still be accurate for players who haven't reached
 * whatever milestone unlocks the later pool.
 */
export function parseDropRatesByJunk(html: string): ParseDropRatesByJunkResult {
  const $ = cheerio.load(html);
  const rowsByJunk = new Map<string, ParsedJunkDropRow[]>();
  const junksWithMultiplePools = new Set<string>();

  const sections = $('h2, table').toArray() as Element[];
  for (const [i, section] of sections.entries()) {
    if (section.name !== 'h2') {
      continue;
    }

    const junkName = $(section).text().trim();
    const table = sections[i + 1];
    if (!table || table.name !== 'table') {
      throw new Error(`Expected a <table> immediately after <h2>${junkName}</h2>.`);
    }

    validateHeader($, table, junkName);
    const parsedRows = parseJunkTable($, table, junkName);

    const previousRows = rowsByJunk.get(junkName);
    if (previousRows) {
      junksWithMultiplePools.add(junkName);
      console.warn(
        `[parseDropRatesByJunk] Duplicate <h2>${junkName}</h2> section — the source page lists `
        + `this junk more than once. Keeping the later occurrence (${parsedRows.length} row(s)), `
        + `discarding the earlier one (${previousRows.length} row(s)).`,
      );
    }
    rowsByJunk.set(junkName, parsedRows);
  }

  const rows = [...rowsByJunk.values()].flat();
  warnOnSuspiciousTotals(rows);
  return { rows, junksWithMultiplePools };
}
