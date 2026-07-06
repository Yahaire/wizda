import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { BLESSINGS, getBlessingCode, StatKind } from '@shared/domain/stats';

import { ParsedEquipmentBlessingDropRateRow } from './equipmentBlessingDropRate.models';
import { isCloseToOne, parsePercent } from './rateParsing';

const EXPECTED_COLUMN_COUNT = 2 + BLESSINGS.length;
const HEADER_LABEL_PATTERN = /^(.+) Increase \((%|fixed)\)$/;
const STAT_LABELS = Object.values(StatKind) as string[];

/** Row that starts a new equipment block: equipment + slot + 19 blessing rates. */
const BLOCK_START_CELL_COUNT = 2 + BLESSINGS.length;
/** Row that continues the current block: slot + 19 blessing rates. */
const BLOCK_CONTINUATION_CELL_COUNT = 1 + BLESSINGS.length;

/**
 * Checks whether `table`'s header matches the "Additional Blessing Drop Rates
 * by Equipment" shape and, if so, returns the blessing code for each of the
 * 19 rate columns in the order they actually appear (the source does NOT use
 * natural stat order — SUR is listed before ASPD in the "fixed" columns — so
 * this is derived from the header text, not assumed).
 */
function tryGetColumnBlessingCodes($: cheerio.CheerioAPI, table: Element): string[] | undefined {
  const headers = $(table)
    .find('thead > tr')
    .eq(0)
    .find('> th')
    .toArray()
    .map((th) => $(th).text().trim());

  if (headers.length !== EXPECTED_COLUMN_COUNT || headers[0] !== 'Equipment' || headers[1] !== 'Additional Blessing Slots') {
    return undefined;
  }

  const columnBlessingCodes: string[] = [];
  for (const header of headers.slice(2)) {
    const match = HEADER_LABEL_PATTERN.exec(header);
    if (!match) {
      return undefined;
    }

    const label = match[1]!;
    const variant = match[2]!;
    if (!STAT_LABELS.includes(label)) {
      return undefined;
    }

    columnBlessingCodes.push(getBlessingCode(label as StatKind, variant === '%'));
  }

  const expectedCodes = new Set(BLESSINGS.map((b) => b.code));
  const actualCodes = new Set(columnBlessingCodes);
  const isExactCatalogMatch =
    columnBlessingCodes.length === BLESSINGS.length
    && actualCodes.size === expectedCodes.size
    && [...expectedCodes].every((code) => actualCodes.has(code));

  return isExactCatalogMatch ? columnBlessingCodes : undefined;
}

export interface ParseEquipmentBlessingDropRatesResult {
  rows: ParsedEquipmentBlessingDropRateRow[];
  /** Equipment names whose 4-row block appeared more than once — see below. */
  equipmentWithMultipleBlocks: Set<string>;
}

/**
 * Parses "Additional Blessing Drop Rates by Equipment" into one row per
 * (equipment, slot, blessing) with a nonzero rate (a "-" in the source means
 * exactly 0 and is simply not emitted as a row, per docs/domain.md).
 *
 * The source page has several unrelated tables (an "Alteration Stone"
 * reroll-mechanic example, plus two "Full Alteration Stones" sections) mixed
 * in alongside the one we want, so rather than anchoring on heading text or
 * table position, every `<table>` is checked against the expected 21-column
 * header shape and exactly one match is required.
 */
export function parseEquipmentBlessingDropRates(html: string): ParseEquipmentBlessingDropRatesResult {
  const $ = cheerio.load(html);
  const tables = $('table').toArray() as Element[];

  const matches = tables
    .map((table) => ({ table, columnBlessingCodes: tryGetColumnBlessingCodes($, table) }))
    .filter(
      (candidate): candidate is { table: Element; columnBlessingCodes: string[] } =>
        candidate.columnBlessingCodes !== undefined,
    );

  if (matches.length !== 1) {
    throw new Error(
      'Expected exactly one table matching the "Additional Blessing Drop Rates by Equipment" header '
      + `shape, found ${matches.length}.`,
    );
  }

  const { table, columnBlessingCodes } = matches[0]!;

  const rowsByEquipment = new Map<string, ParsedEquipmentBlessingDropRateRow[]>();
  const equipmentWithMultipleBlocks = new Set<string>();

  let currentEquipmentName: string | undefined;
  let currentBlockRows: ParsedEquipmentBlessingDropRateRow[] = [];

  const commitCurrentBlock = (): void => {
    if (currentEquipmentName === undefined) {
      return;
    }

    const previousRows = rowsByEquipment.get(currentEquipmentName);
    if (previousRows) {
      equipmentWithMultipleBlocks.add(currentEquipmentName);
      console.warn(
        `[parseEquipmentBlessingDropRates] Duplicate block for "${currentEquipmentName}" — keeping the `
        + `later occurrence (${currentBlockRows.length} row(s)), discarding the earlier one `
        + `(${previousRows.length} row(s)).`,
      );
    }
    rowsByEquipment.set(currentEquipmentName, currentBlockRows);
  };

  $(table)
    .find('tbody > tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('> td')
        .toArray()
        .map((td) => $(td).text());

      let slotText: string;
      let rateCells: string[];
      if (cells.length === BLOCK_START_CELL_COUNT) {
        commitCurrentBlock();
        const [equipmentName, slotCellText, ...rest] = cells;
        currentEquipmentName = equipmentName!.trim();
        currentBlockRows = [];
        slotText = slotCellText!;
        rateCells = rest;
      } else if (cells.length === BLOCK_CONTINUATION_CELL_COUNT) {
        const [slotCellText, ...rest] = cells;
        slotText = slotCellText!;
        rateCells = rest;
      } else {
        throw new Error(
          `Unexpected row shape: ${cells.length} <td> cells (expected ${BLOCK_START_CELL_COUNT} or `
          + `${BLOCK_CONTINUATION_CELL_COUNT}).`,
        );
      }

      const slot = parseInt(slotText, 10);
      let slotRateSum = 0;
      rateCells.forEach((cellText, i) => {
        const rate = parsePercent(cellText);
        slotRateSum += rate;
        if (rate > 0) {
          currentBlockRows.push({
            equipmentName: currentEquipmentName!,
            slot,
            blessingCode: columnBlessingCodes[i]!,
            rate,
          });
        }
      });

      if (!isCloseToOne(slotRateSum)) {
        console.warn(
          `[parseEquipmentBlessingDropRates] "${currentEquipmentName}" slot ${slot} blessing rates sum to `
          + `${(slotRateSum * 100).toFixed(4)}%, expected ~100%.`,
        );
      }
    });
  commitCurrentBlock();

  const rows = [...rowsByEquipment.values()].flat();
  return { rows, equipmentWithMultipleBlocks };
}
