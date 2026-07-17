import * as dotenv from 'dotenv';
import path from 'path';

import { PrismaClient } from '@local-prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SOURCE_LANGUAGE } from '@shared/domain/language';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';

import { parseDropRatesByJunk } from './dropRatesByJunk.parser';
import { seedDropRatesByJunk } from './dropRatesByJunk.seed';
import { parseEquipmentBlessingDropRates } from './equipmentBlessingDropRate.parser';
import { seedEquipmentBlessingDropRates } from './equipmentBlessingDropRate.seed';
import { buildTaxonomyByName } from './equipmentTaxonomy.mapping';
import { seedEquipmentTaxonomy } from './equipmentTaxonomy.seed';
import { loadCsv } from './loadCsv';
import { loadHtml } from './loadHtml';
import { seedLocalizedNames } from './seedLocalizedNames';
import { seedStaticReferenceData } from './seedStaticReferenceData';
import { buildDropRateSourceUrl } from './sourceUrls';

// Load the root .env (this file lives at packages/backend-api/prisma/seed-from-html).
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Base URL + per-page URIs the drop-rate pages are composed from:
 * `<BASE>/<lang>/<URI>`. English (the source-of-truth language) and every
 * localized language (see `seedLocalizedNames`) share this same composition —
 * see `sourceUrls.ts`. Example:
 * https://wizardry.info/daphne/gacha_rates/en/equipments.html
 */
const DROP_RATE_LIST_BASE_URL = process.env.OFFICIAL_DROP_RATE_LIST_BASE_URL;
const JUNK_DROP_RATES_URI = process.env.OFFICIAL_JUNK_DROP_RATES_URI;
const BLESSING_DROP_RATES_URI = process.env.OFFICIAL_BLESSING_DROP_RATES_URI;

/**
 * Sources of the Fasterthoughts equipment taxonomy CSVs (weapons + armor). Each
 * is a remote URL (raw GitHub) or a path to a local copy. They carry each item's
 * category (Type / Armor Type) and rank (Rank), matched to our equipment by name.
 * Examples: https://raw.githubusercontent.com/itsnicksia/wizardry-daphne-guide/main/data/weapon.csv
 */
const WEAPON_TAXONOMY_SOURCE = process.env.WEAPON_TAXONOMY_SOURCE_URL;
const ARMOR_TAXONOMY_SOURCE = process.env.ARMOR_TAXONOMY_SOURCE_URL;

async function main(): Promise<void> {
  if (!DROP_RATE_LIST_BASE_URL) {
    throw new Error('OFFICIAL_DROP_RATE_LIST_BASE_URL is not set (see .env.example).');
  }
  if (!JUNK_DROP_RATES_URI) {
    throw new Error('OFFICIAL_JUNK_DROP_RATES_URI is not set (see .env.example).');
  }
  if (!BLESSING_DROP_RATES_URI) {
    throw new Error('OFFICIAL_BLESSING_DROP_RATES_URI is not set (see .env.example).');
  }
  if (!WEAPON_TAXONOMY_SOURCE) {
    throw new Error('WEAPON_TAXONOMY_SOURCE_URL is not set (see .env.example).');
  }
  if (!ARMOR_TAXONOMY_SOURCE) {
    throw new Error('ARMOR_TAXONOMY_SOURCE_URL is not set (see .env.example).');
  }

  const JUNK_DROP_RATES_SOURCE = buildDropRateSourceUrl(DROP_RATE_LIST_BASE_URL, SOURCE_LANGUAGE, JUNK_DROP_RATES_URI);
  const EQUIPMENT_BLESSING_DROP_RATES_SOURCE =
    buildDropRateSourceUrl(DROP_RATE_LIST_BASE_URL, SOURCE_LANGUAGE, BLESSING_DROP_RATES_URI);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    console.log('[seed] seeding static reference data '
      + '(stats, blessings, equipment types/categories/ranks)...');
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

    console.log('[seed] syncing localized (ja/ko/de) junk + equipment names...');
    await seedLocalizedNames(prisma, parsedJunk, {
      baseUrl: DROP_RATE_LIST_BASE_URL,
      junkUri: JUNK_DROP_RATES_URI,
    });

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

    const obtainableRanks = new Set(
      EQUIPMENT_RANKS.filter((rank) => rank.isObtainableThroughJunk).map((rank) => rank.kind),
    );
    const taxonomy = await seedEquipmentTaxonomy(prisma, taxonomyByName, obtainableRanks);
    console.log(`[seed] taxonomy: enriched ${taxonomy.updated} existing + created ${taxonomy.created} new `
      + `equipment (from ${taxonomy.totalTaxonomyEntries} taxonomy entry/entries).`);
    if (taxonomy.withoutCategory.length > 0) {
      console.log(`[seed] taxonomy: ${taxonomy.withoutCategory.length} item(s) got a rank but `
        + `no category (source lacked a weight class): ${taxonomy.withoutCategory.join(', ')}`);
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
        + 'non-obtainable rank:');
      for (const { name, rank } of taxonomy.anomalies) {
        console.log(`[seed]   - ${name} (${rank})`);
      }
    }

    // Stamp the completion time as the final DB write, so a failed or partial
    // seed above never bumps it. Surfaced to players as "data last updated".
    const seededAt = new Date();
    await prisma.dataStatus.upsert({
      where: { id: 1 },
      update: { lastSeededAt: seededAt },
      create: { id: 1, lastSeededAt: seededAt },
    });
    // English's own LanguageStatus row: a deliberate, cheap duplicate of the
    // stamp above (always in sync) so LanguageStatus is uniform across every
    // language — see the model doc in schema.prisma.
    await prisma.languageStatus.upsert({
      where: { lang: SOURCE_LANGUAGE },
      update: { isInSync: true, lastSyncedAt: seededAt, lastCheckedAt: seededAt },
      create: { lang: SOURCE_LANGUAGE, isInSync: true, lastSyncedAt: seededAt, lastCheckedAt: seededAt },
    });
    console.log(`[seed] done. Stamped data update time: ${seededAt.toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
