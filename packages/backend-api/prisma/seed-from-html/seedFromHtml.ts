import * as dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

import * as cheerio from 'cheerio';

import { ParsedGachaRate } from './seedFromHtml.models';

// Load the root .env (this file lives at packages/backend-api/prisma/seed-from-html).
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Source of the gacha-rate HTML. Either a remote URL or a path to a local copy
 * (handy while iterating on the parser without hammering the source site).
 * Example: https://wizardry.info/daphne/gacha_rates/en/alternations.html
 */
const SOURCE = process.env.GACHA_RATES_SOURCE_URL;

/** Fetch the raw HTML, from a local file if the source looks like a path, else over HTTP. */
async function loadHtml(source: string): Promise<string> {
  if (existsSync(source)) {
    return readFile(source, 'utf-8');
  }
  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Parse the source HTML into structured gacha rates.
 *
 * TODO: implement the real extraction. Inspect the table/markup on the source
 * page and pull out item names, rates and pools. The cheerio handle (`$`) is
 * already loaded and ready to query.
 */
function parseGachaRates(html: string): ParsedGachaRate[] {
  const $ = cheerio.load(html);
  const rates: ParsedGachaRate[] = [];

  // Example shape (remove once the real selectors are known):
  //
  // $('table.rates tr').each((_, row) => {
  //   const cells = $(row).find('td');
  //   rates.push({
  //     itemName: $(cells[0]).text().trim(),
  //     rate: parseFloat($(cells[1]).text()) / 100,
  //     pool: $(cells[2]).text().trim(),
  //   });
  // });

  return rates;
}

/**
 * Persist parsed rates into the database.
 *
 * TODO: wire up Prisma once the schema has models. Run `npx prisma generate`
 * first, then import and use the client. Something like:
 *
 *   import { PrismaClient } from '@local-prisma/generated/client';
 *   import { PrismaPg } from '@prisma/adapter-pg';
 *   import { Pool } from 'pg';
 *
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
 *   // upsert rates...
 */
async function seed(rates: ParsedGachaRate[]): Promise<void> {
  console.log(`[seed] parsed ${rates.length} rate(s) — DB write not implemented yet.`);
}

async function main(): Promise<void> {
  if (!SOURCE) {
    throw new Error('GACHA_RATES_SOURCE_URL is not set (see .env.example).');
  }

  console.log(`[seed] loading HTML from: ${SOURCE}`);
  const html = await loadHtml(SOURCE);

  console.log('[seed] parsing...');
  const rates = parseGachaRates(html);

  await seed(rates);
  console.log('[seed] done.');
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
