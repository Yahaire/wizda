import * as dotenv from 'dotenv';
import path from 'path';

import { PrismaClient } from '@local-prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SOURCE_LANGUAGE } from '@shared/domain/language';
import { EQUIPMENT_RANKS, EquipmentRankKind } from '@shared/domain/rank';

import { buildBlessingValueBonuses } from './blessingValueBonuses';
import { assignValueGroups } from './blessingValueGroups.mapping';
import { parseBlessingValueRates } from './blessingValueRates.parser';
import { seedBlessingValueRates } from './blessingValueRates.seed';
import { parseDropRatesByJunk } from './dropRatesByJunk.parser';
import { seedDropRatesByJunk } from './dropRatesByJunk.seed';
import { parseEquipmentBlessingDropRates } from './equipmentBlessingDropRate.parser';
import { seedEquipmentBlessingDropRates } from './equipmentBlessingDropRate.seed';
import { buildTaxonomyByName, TaxonomyDrift } from './equipmentTaxonomy.mapping';
import { seedEquipmentTaxonomy } from './equipmentTaxonomy.seed';
import { loadCsv } from './loadCsv';
import { loadHtml } from './loadHtml';
import { seedJapaneseReadings } from './seedJapaneseReadings';
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

/** One named block of drifted values for {@link logActionRequired}. */
interface ActionRequiredSection {
  heading: string;
  values: readonly string[];
}

/**
 * Print every unmapped/unresolved value from every seed pass as ONE loud,
 * delimited block. Deliberately the last thing the seed writes, and
 * deliberately one block rather than several: above it sit hundreds of
 * `unmatchedNames` lines, and the whole point of this section is that a human
 * reads all of it in one place rather than catching part of it before the
 * terminal scrolls past. It is *not* a failure — the seed completed and the
 * site is up (a non-zero exit would make `scripts/seed-with-maintenance.mjs`
 * hold `.maintenance`, taking the whole site down over a missing label).
 */
function logActionRequired(sections: readonly ActionRequiredSection[]): void {
  const nonEmpty = sections.filter((section) => section.values.length > 0);
  if (nonEmpty.length === 0) {
    return;
  }

  const rule = '='.repeat(72);
  const lines: string[] = [
    '',
    rule,
    '[seed] ACTION REQUIRED — some scraped values could not be mapped.',
    '[seed] The seed COMPLETED and the site is up. The items below were stored,',
    '[seed] just without the field we could not resolve.',
    '',
  ];

  for (const { heading, values } of nonEmpty) {
    lines.push(`[seed]   ${heading}`);
    for (const value of values) {
      lines.push(`[seed]     - ${value}`);
    }
  }

  lines.push(
    '',
    '[seed] Fix: for taxonomy drift see "Adding a new equipment category" in docs/domain.md;',
    '[seed] for blessing-value drift see docs/domain.md and docs/milestone-blessings.md.',
    '[seed] Then re-run the seed so the affected items pick the new codes/links up.',
    rule,
    '',
  );
  console.log(lines.join('\n'));
}

/** `TaxonomyDrift` -> its four `ActionRequiredSection`s. */
function taxonomyDriftSections(drift: TaxonomyDrift): ActionRequiredSection[] {
  return [
    { heading: 'Unknown weapon Type (stored without a category):', values: drift.weaponTypes },
    { heading: 'Unknown armor weight class (stored without a category):', values: drift.armorWeightClasses },
    { heading: 'Unknown armor Type — a NEW GEAR SLOT, needs a Prisma migration:', values: drift.armorTypes },
    { heading: 'Unknown Rank (each item KEPT its previous rank):', values: drift.ranks },
  ];
}

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

    // Strictly after the names above — it reads them back out of the DB.
    console.log('[seed] computing Japanese name readings (kana search keys)...');
    await seedJapaneseReadings(prisma);

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
    const { byName: taxonomyByName, drift } = buildTaxonomyByName(weaponRows, armorRows);
    console.log(`[seed] parsed taxonomy for ${taxonomyByName.size} item(s) `
      + `(${weaponRows.length} weapon + ${armorRows.length} armor row(s)).`);

    const obtainableRanks = new Set(
      EQUIPMENT_RANKS.filter((rank) => rank.isObtainableThroughJunk).map((rank) => rank.kind),
    );
    const taxonomy = await seedEquipmentTaxonomy(prisma, taxonomyByName, obtainableRanks);
    console.log(`[seed] taxonomy: enriched ${taxonomy.updated} existing + created ${taxonomy.created} new `
      + `equipment (from ${taxonomy.totalTaxonomyEntries} taxonomy entry/entries).`);
    if (taxonomy.withoutCategory.length > 0) {
      console.log(`[seed] taxonomy: ${taxonomy.withoutCategory.length} item(s) stored without a `
        + `category (source lacked, or we could not map, a weight class): `
        + `${taxonomy.withoutCategory.join(', ')}`);
    }
    if (taxonomy.withoutRank.length > 0) {
      console.log(`[seed] taxonomy: ${taxonomy.withoutRank.length} item(s) had no usable rank in the `
        + `source (each kept whatever rank it already had): ${taxonomy.withoutRank.join(', ')}`);
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

    // After the taxonomy pass: assignment needs rank + categoryCode, which the
    // taxonomy pass just filled in. Reuses `blessingHtml` already loaded above —
    // the value tables live on the same "alternations.html" page as the
    // per-equipment blessing drop rates, nothing is fetched twice.
    console.log('[seed] parsing additional-blessing value rates (what number a blessing lands on)...');
    const equipmentForBlessingValues = (await prisma.equipment.findMany({
      select: { id: true, name: true, rank: true, categoryCode: true },
    })).map((item) => ({ ...item, rank: item.rank as EquipmentRankKind | null }));
    const blessingValueEquipmentNames = new Set(equipmentForBlessingValues.map((item) => item.name));
    const parsedValues = parseBlessingValueRates(blessingHtml, { equipmentNames: blessingValueEquipmentNames });
    console.log(`[seed] parsed ${parsedValues.rows.length} blessing value row(s) across `
      + `${parsedValues.sources.length} source(s) and ${parsedValues.groups.length} group(s).`);

    const { bonuses, missingSources } = buildBlessingValueBonuses(parsedValues.rows);
    const unverifiedBonuses = bonuses.filter((bonus) => !bonus.isVerified);
    console.log(`[seed] derived ${bonuses.length} milestone bonus(es) `
      + `(${unverifiedBonuses.length} unverified, ${missingSources.length} not derivable at all).`);

    const { groupCodeById, drift: groupAssignmentDrift } =
      assignValueGroups(parsedValues.groups, equipmentForBlessingValues);

    const blessingValues = await seedBlessingValueRates(prisma, {
      sources: parsedValues.sources,
      groups: parsedValues.groups,
      rows: parsedValues.rows,
      bonuses,
      groupCodeById,
    });
    console.log(`[seed] blessing values: stored ${blessingValues.rates} rate row(s) and `
      + `${blessingValues.bonuses} bonus(es), linked ${blessingValues.equipmentAssigned} equipment to a value group.`);

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

    // Last, so it can't scroll away above the unmatched-name dump.
    logActionRequired([
      ...taxonomyDriftSections(drift),
      { heading: 'Unrecognised <h1> source heading in the value tables (stored under a derived code):',
        values: parsedValues.drift.unknownSourceHeadings },
      { heading: 'Unclassifiable <h2> value-group heading (rates stored, equipment left unlinked):',
        values: parsedValues.drift.unclassifiedGroupHeadings },
      { heading: 'Value-group heading token matching neither a category nor an equipment name:',
        values: parsedValues.drift.unknownSelectorTokens },
      { heading: 'Unrecognised blessing label in a value table (that one row skipped):',
        values: parsedValues.drift.unknownBlessingLabels },
      { heading: 'Equipment with a rank but no blessing-value group (a rank-range gap):',
        values: groupAssignmentDrift.withoutGroup },
      { heading: 'Equipment with no rank at all (no blessing-value group derivable):',
        values: groupAssignmentDrift.withoutRank },
      { heading: 'Named value-group token matching no equipment in the current catalog:',
        values: groupAssignmentDrift.namedTokensUnmatched },
      { heading: "Named value-group token whose matched equipment's rank sits outside the group's range:",
        values: groupAssignmentDrift.namedOutsideRange },
      { heading: '(group, quality, blessing) with no LFAS counterpart — bonus not derivable at all:',
        values: missingSources.map(({ groupCode, quality, blessingCode }) => `${groupCode} / q${quality} / ${blessingCode}`) },
      { heading: 'Blessing-value bonus that failed reconvolution verification (stored anyway, flagged unverified):',
        values: unverifiedBonuses.map(
          ({ groupCode, quality, blessingCode, verificationNote }) =>
            `${groupCode} / q${quality} / ${blessingCode}: ${verificationNote}`,
        ) },
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
