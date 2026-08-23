import { describe, expect, it } from 'vitest';

import { parseBlessingValueRates } from './blessingValueRates.parser';

const EQUIPMENT_NAMES = new Set(['Some Named Weapon']);

interface FixtureRow {
  quality?: number;
  label: string;
  cells: string[];
}

function valueRow(cells: string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
}

/**
 * Builds one value table. Real tables are 5 qualities x 19 blessings
 * (docs/milestone-blessings.md); the parser only warns, never throws, on a
 * table whose body isn't that shape, so a small fixture is enough to exercise
 * the row-shape rules without 95-row fixtures in every test.
 */
function valueTable(values: number[], rows: FixtureRow[]): string {
  const header = '<thead><tr><th>Quality</th><th>Additional Blessings</th>'
    + values.map((v) => `<th>${v}</th>`).join('')
    + '</tr></thead>';
  const body = rows
    .map((row) => valueRow(row.quality !== undefined ? [String(row.quality), row.label, ...row.cells] : [row.label, ...row.cells]))
    .join('');
  return `<table>${header}<tbody>${body}</tbody></table>`;
}

const ALTERATION_EXAMPLE_TABLE = `
  <table>
    <thead><tr><th>Item Name</th><th>1%</th><th>2%</th><th>3%</th><th>4%</th><th>5%</th></tr></thead>
    <tbody><tr><td>Some Item</td><td>10%</td><td>20%</td><td>30%</td><td>20%</td><td>20%</td></tr></tbody>
  </table>`;

const BY_EQUIPMENT_DECOY_TABLE = `
  <table>
    <thead><tr><th>Equipment</th><th>Additional Blessing Slots</th><th>ATK Increase (%)</th></tr></thead>
    <tbody><tr><td>Some Weapon</td><td>1</td><td>100%</td></tr></tbody>
  </table>`;

describe('parseBlessingValueRates', () => {
  it('parses all four <h2> group shapes and reuses a group code across sources by heading text', () => {
    const html = `
      ${ALTERATION_EXAMPLE_TABLE}
      ${BY_EQUIPMENT_DECOY_TABLE}
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([1, 2], [
    { quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] },
    { label: 'MAG Increase (fixed)', cells: ['50%', '50%'] },
  ])}
      <h2>Equipment Rank 6 (Bow)</h2>
      ${valueTable([1, 2], [
    { quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] },
  ])}
      <h2>Equipment Rank 6 (Some Named Weapon)</h2>
      ${valueTable([1, 2], [
    { quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] },
  ])}
      <h2>Equipment Rank 6 (Excluding weapons listed above)</h2>
      ${valueTable([1, 2], [
    { quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] },
  ])}
      <h1>Additional Blessing Value Drop Rates When Using Lesser Full Alteration Stones</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([2, 3], [
    { quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] },
  ])}
    `;

    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });

    expect(result.sources.map((s) => s.code)).toEqual(['DROP', 'LFAS']);
    expect(result.groups.map((g) => g.selector.code)).toEqual([
      'RANK_1_5', 'RANK_6_CATEGORY', 'RANK_6_NAMED', 'RANK_6_FALLBACK',
    ]);
    // "Equipment Rank 1-5" appears under both <h1> sections — one group, not two.
    expect(result.groups.filter((g) => g.selector.code === 'RANK_1_5')).toHaveLength(1);

    expect(result.drift.unknownSourceHeadings).toEqual([]);
    expect(result.drift.unclassifiedGroupHeadings).toEqual([]);
    expect(result.drift.unknownBlessingLabels).toEqual([]);

    expect(result.rows).toContainEqual({
      groupCode: 'RANK_1_5', sourceCode: 'DROP', quality: 1, blessingCode: 'ATK', value: 1, rate: 0.5,
    });
    expect(result.rows).toContainEqual({
      groupCode: 'RANK_1_5', sourceCode: 'LFAS', quality: 1, blessingCode: 'ATK', value: 2, rate: 0.5,
    });
  });

  it('appends a numeric suffix when two different headings derive the same base code', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 6 (Bow)</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] }])}
      <h2>Equipment Rank 6 (Cesti)</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] }])}
    `;

    // Both single-category headings derive the base code RANK_6_CATEGORY — the
    // second must not silently collide with (or overwrite) the first.
    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });
    const codes = result.groups.map((g) => g.selector.code);

    expect(codes).toEqual(['RANK_6_CATEGORY', 'RANK_6_CATEGORY_2']);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('never emits a row for a "-" cell', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['-', '100%'] }])}
    `;

    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ value: 2, rate: 1 });
  });

  it('reads each value from the column header text, not the column position', () => {
    // The real page's first value column is 1, 2 or 3 depending on the section
    // (docs/milestone-blessings.md) — assert that isn't assumed.
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([7, 9, 15], [{ quality: 3, label: 'ATK Increase (fixed)', cells: ['20%', '30%', '50%'] }])}
    `;

    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });

    expect(result.rows.map((r) => r.value)).toEqual([7, 9, 15]);
  });

  it('does not throw on a row whose rates do not sum to ~100% — warns instead', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['20%', '20%'] }])}
    `;

    expect(() => parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES })).not.toThrow();
  });

  it('stores rates and records drift for an unrecognised <h1>, rather than throwing', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] }])}
      <h1>Some New Section The Devs Added</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] }])}
    `;

    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });

    expect(result.drift.unknownSourceHeadings).toEqual(['Some New Section The Devs Added']);
    expect(result.sources.map((s) => s.code)).toEqual(['DROP', 'SOME_NEW_SECTION_THE_DEVS_ADDED']);
    expect(result.rows.some((r) => r.sourceCode === 'SOME_NEW_SECTION_THE_DEVS_ADDED')).toBe(true);
  });

  it('stores rates and records drift for an unclassifiable <h2>, leaving the group UNKNOWN', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Something Nobody Has Seen</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] }])}
    `;

    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });

    expect(result.drift.unclassifiedGroupHeadings).toEqual(['Something Nobody Has Seen']);
    expect(result.rows).toHaveLength(2); // both value columns (1 and 2) have a nonzero rate
  });

  it('skips a row with an unrecognised blessing label and records it as drift', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([1, 2], [
    { quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] },
    { label: 'LUCK Increase (fixed)', cells: ['50%', '50%'] },
  ])}
    `;

    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });

    expect(result.rows.every((r) => r.blessingCode === 'ATK')).toBe(true);
    expect(result.drift.unknownBlessingLabels).toEqual(['LUCK Increase (fixed)']);
  });

  it('throws on a row with an unexpected cell count', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      <table>
        <thead><tr><th>Quality</th><th>Additional Blessings</th><th>1</th><th>2</th></tr></thead>
        <tbody><tr><td>ATK Increase (fixed)</td><td>50%</td></tr></tbody>
      </table>
    `;

    expect(() => parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES })).toThrow(/row shape/);
  });

  it('throws when no DROP rows are found at all', () => {
    const html = `
      <h1>Additional Blessing Value Drop Rates When Using Full Alteration Stones</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([3, 4], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] }])}
    `;

    expect(() => parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES })).toThrow(/DROP/);
  });

  it('ignores tables of another shape — the Alteration Stone example and the by-equipment table', () => {
    const html = `
      ${ALTERATION_EXAMPLE_TABLE}
      ${BY_EQUIPMENT_DECOY_TABLE}
      <h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>
      <h2>Equipment Rank 1-5</h2>
      ${valueTable([1, 2], [{ quality: 1, label: 'ATK Increase (fixed)', cells: ['50%', '50%'] }])}
    `;

    const result = parseBlessingValueRates(html, { equipmentNames: EQUIPMENT_NAMES });

    expect(result.rows).toHaveLength(2); // both value columns (1 and 2) have a nonzero rate
  });
});
