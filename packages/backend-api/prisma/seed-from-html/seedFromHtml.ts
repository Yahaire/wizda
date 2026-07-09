import * as dotenv from 'dotenv';
import path from 'path';

import { PrismaClient } from '@local-prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { EQUIPMENT_TIERS } from '@shared/domain/tier';

import { parseDropRatesByJunk } from './dropRatesByJunk.parser';
import { seedDropRatesByJunk } from './dropRatesByJunk.seed';
import { parseEquipmentBlessingDropRates } from './equipmentBlessingDropRate.parser';
import { seedEquipmentBlessingDropRates } from './equipmentBlessingDropRate.seed';
import { buildTaxonomyByName } from './equipmentTaxonomy.mapping';
import { seedEquipmentTaxonomy } from './equipmentTaxonomy.seed';
import { loadCsv } from './loadCsv';
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

/**
 * Sources of the Fasterthoughts equipment taxonomy CSVs (weapons + armor). Each
 * is a remote URL (raw GitHub) or a path to a local copy. They carry each item's
 * category (Type / Armor Type) and tier (Rank), matched to our equipment by name.
 * Examples: https://raw.githubusercontent.com/itsnicksia/wizardry-daphne-guide/main/data/weapon.csv
 */
const WEAPON_TAXONOMY_SOURCE = process.env.WEAPON_TAXONOMY_SOURCE_URL;
const ARMOR_TAXONOMY_SOURCE = process.env.ARMOR_TAXONOMY_SOURCE_URL;

async function main(): Promise<void> {
  if (!JUNK_DROP_RATES_SOURCE) {
    throw new Error('JUNK_DROP_RATES_SOURCE_URL is not set (see .env.example).');
  }
  if (!EQUIPMENT_BLESSING_DROP_RATES_SOURCE) {
    throw new Error('EQUIPMENT_BLESSING_DROP_RATES_SOURCE_URL is not set (see .env.example).');
  }
  if (!WEAPON_TAXONOMY_SOURCE) {
    throw new Error('WEAPON_TAXONOMY_SOURCE_URL is not set (see .env.example).');
  }
  if (!ARMOR_TAXONOMY_SOURCE) {
    throw new Error('ARMOR_TAXONOMY_SOURCE_URL is not set (see .env.example).');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    console.log('[seed] seeding static reference data '
      + '(stats, blessings, equipment types/categories/tiers)...');
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

    console.log(`[seed] loading equipment taxonomy CSVs: weapons=${WEAPON_TAXONOMY_SOURCE}, `
      + `armor=${ARMOR_TAXONOMY_SOURCE}`);
    const [weaponRows, armorRows] = await Promise.all([
      loadCsv(WEAPON_TAXONOMY_SOURCE),
      loadCsv(ARMOR_TAXONOMY_SOURCE),
    ]);
    const taxonomyByName = buildTaxonomyByName(weaponRows, armorRows);
    console.log(`[seed] parsed taxonomy for ${taxonomyByName.size} item(s) `
      + `(${weaponRows.length} weapon + ${armorRows.length} armor row(s)).`);

    const obtainableTiers = new Set(
      EQUIPMENT_TIERS.filter((tier) => tier.isObtainableThroughJunk).map((tier) => tier.kind),
    );
    const taxonomy = await seedEquipmentTaxonomy(prisma, taxonomyByName, obtainableTiers);
    console.log(`[seed] taxonomy: enriched ${taxonomy.matched}/${taxonomy.totalEquipment} `
      + 'equipment with category + tier.');
    if (taxonomy.matchedWithoutCategory.length > 0) {
      console.log(`[seed] taxonomy: ${taxonomy.matchedWithoutCategory.length} matched item(s) got a tier but `
        + `no category (source lacked a weight class): ${taxonomy.matchedWithoutCategory.join(', ')}`);
    }
    if (taxonomy.unmatchedNames.length > 0) {
      console.log(`[seed] taxonomy: ${taxonomy.unmatchedNames.length} equipment not found in the CSVs `
        + '(name drift or genuinely absent):');
      for (const name of taxonomy.unmatchedNames) {
        console.log(`[seed]   - ${name}`);
      }
    }
    if (taxonomy.anomalies.length > 0) {
      console.log(`[seed] taxonomy: WARNING ${taxonomy.anomalies.length} junk-sourced item(s) mapped to a `
        + 'non-obtainable tier:');
      for (const { name, tier } of taxonomy.anomalies) {
        console.log(`[seed]   - ${name} (${tier})`);
      }
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
