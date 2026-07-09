import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

import { parse } from 'csv-parse/sync';

/** One CSV row as a `header -> value` object (all values are strings). */
export type CsvRow = Record<string, string>;

/**
 * Load + parse a CSV, from a local file if the source looks like a path, else
 * over HTTP (same fetch-or-read convention as {@link loadHtml}). Parsed with a
 * header row (`columns: true`); values are trimmed. `relax_column_count` tolerates
 * ragged rows (the source has trailing/blank separator lines between sections).
 */
export async function loadCsv(source: string): Promise<CsvRow[]> {
  const raw = existsSync(source) ? await readFile(source, 'utf-8') : await fetchCsv(source);
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

async function fetchCsv(source: string): Promise<string> {
  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
