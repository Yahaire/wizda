import * as dotenv from 'dotenv';
import path from 'path';

import { PrismaClient } from '@local-prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { parseDropRatesByJunk } from './dropRatesByJunk.parser';
import { seedDropRatesByJunk } from './dropRatesByJunk.seed';
import { parseEquipmentBlessingDropRates } from './equipmentBlessingDropRate.parser';
import { seedEquipmentBlessingDropRates } from './equipmentBlessingDropRate.seed';
import { loadHtml } from './loadHtml';
import { seedStaticReferenceData } from './seedStaticReferenceData';

// Load the root .env (this file lives at packages/backend-api/prisma/seed-from-html).
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Source of the "Drop Rates by Junk" HTML page. Either a remote URL or a path
 * to a local copy (handy while iterating on the parser without hammering the
 * source site). Example: https://wizardry.info/daphne/gacha_rates/en/equipments.html
 */
const JUNK_DROP_RATES_SOURCE = process.env.JUNK_DROP_RATES_SOURCE_URL;

/**
 * Source of the "Drop Rates Related to Additional Blessings" HTML page.
 * Example: https://wizardry.info/daphne/gacha_rates/en/alternations.html
 */
const EQUIPMENT_BLESSING_DROP_RATES_SOURCE = process.env.EQUIPMENT_BLESSING_DROP_RATES_SOURCE_URL;

async function main(): Promise<void> {
  if (!JUNK_DROP_RATES_SOURCE) {
    throw new Error('JUNK_DROP_RATES_SOURCE_URL is not set (see .env.example).');
  }
  if (!EQUIPMENT_BLESSING_DROP_RATES_SOURCE) {
    throw new Error('EQUIPMENT_BLESSING_DROP_RATES_SOURCE_URL is not set (see .env.example).');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    console.log('[seed] seeding static reference data (stats, blessings)...');
    await seedStaticReferenceData(prisma);

    console.log(`[seed] loading junk drop rates from: ${JUNK_DROP_RATES_SOURCE}`);
    const junkHtml = await loadHtml(JUNK_DROP_RATES_SOURCE);
    console.log('[seed] parsing junk drop rates...');
    const parsedJunk = parseDropRatesByJunk(junkHtml);
    console.log(`[seed] parsed ${parsedJunk.rows.length} junk drop-rate row(s).`);
    if (parsedJunk.junksWithMultiplePools.size > 0) {
      console.log(`[seed] ${parsedJunk.junksWithMultiplePools.size} junk(s) had multiple pools: `
        + `${[...parsedJunk.junksWithMultiplePools].join(', ')}`);
    }
    await seedDropRatesByJunk(prisma, parsedJunk);

    console.log(`[seed] loading equipment blessing drop rates from: ${EQUIPMENT_BLESSING_DROP_RATES_SOURCE}`);
    const blessingHtml = await loadHtml(EQUIPMENT_BLESSING_DROP_RATES_SOURCE);
    console.log('[seed] parsing equipment blessing drop rates...');
    const parsedBlessings = parseEquipmentBlessingDropRates(blessingHtml);
    console.log(`[seed] parsed ${parsedBlessings.rows.length} equipment blessing drop-rate row(s).`);
    if (parsedBlessings.equipmentWithMultipleBlocks.size > 0) {
      console.log(`[seed] ${parsedBlessings.equipmentWithMultipleBlocks.size} equipment had multiple blocks: `
        + `${[...parsedBlessings.equipmentWithMultipleBlocks].join(', ')}`);
    }
    await seedEquipmentBlessingDropRates(prisma, parsedBlessings);

    const blessingOnlyEquipmentCount = await prisma.equipment.count({
      where: { blessingRates: { some: {} }, dropRates: { none: {} } },
    });
    if (blessingOnlyEquipmentCount > 0) {
      console.log(`[seed] ${blessingOnlyEquipmentCount} equipment have blessing rates but no known junk drop `
        + 'source (expected for equipment only obtainable via Remains/Bonus Equipment — '
        + 'see docs/domain.md).');
    }

    console.log('[seed] done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
