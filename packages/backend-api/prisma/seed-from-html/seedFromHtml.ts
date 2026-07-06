import * as dotenv from 'dotenv';
import path from 'path';

import { PrismaClient } from '@local-prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { loadHtml } from './loadHtml';
import { parseDropRatesByJunk } from './dropRatesByJunk.parser';
import { seedDropRatesByJunk } from './dropRatesByJunk.seed';

// Load the root .env (this file lives at packages/backend-api/prisma/seed-from-html).
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Source of the "Drop Rates by Junk" HTML page. Either a remote URL or a path
 * to a local copy (handy while iterating on the parser without hammering the
 * source site). Example: https://wizardry.info/daphne/gacha_rates/en/equipments.html
 */
const JUNK_DROP_RATES_SOURCE = process.env.JUNK_DROP_RATES_SOURCE_URL;

async function main(): Promise<void> {
  if (!JUNK_DROP_RATES_SOURCE) {
    throw new Error('JUNK_DROP_RATES_SOURCE_URL is not set (see .env.example).');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    console.log(`[seed] loading junk drop rates from: ${JUNK_DROP_RATES_SOURCE}`);
    const html = await loadHtml(JUNK_DROP_RATES_SOURCE);

    console.log('[seed] parsing...');
    const parsed = parseDropRatesByJunk(html);
    console.log(`[seed] parsed ${parsed.rows.length} drop-rate row(s).`);
    if (parsed.junksWithMultiplePools.size > 0) {
      console.log(`[seed] ${parsed.junksWithMultiplePools.size} junk(s) had multiple pools: `
        + `${[...parsed.junksWithMultiplePools].join(', ')}`);
    }

    await seedDropRatesByJunk(prisma, parsed);
    console.log('[seed] done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
