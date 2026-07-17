import { Prisma, PrismaClient } from '@local-prisma/generated/client';
import { LOCALIZED_LANGUAGES, LocalizedLanguage } from '@shared/domain/language';

import { alignLocalizedNames } from './alignLocalizedNames';
import { parseDropRatesByJunk, ParseDropRatesByJunkResult } from './dropRatesByJunk.parser';
import { loadHtml } from './loadHtml';
import { buildDropRateSourceUrl } from './sourceUrls';

/** The `Equipment`/`Junk` column each localized language writes to. */
const LOCALIZED_NAME_COLUMN: Readonly<Record<LocalizedLanguage, string>> = {
  ja: 'nameJa',
  ko: 'nameKo',
  de: 'nameDe',
};

export interface SeedLocalizedNamesOptions {
  baseUrl: string;
  junkUri: string;
}

/**
 * Bulk-writes one language's aligned names by English `name`, mirroring the
 * `UPDATE … FROM (VALUES …)` pattern `dropRatesByJunk.seed.ts` uses for
 * `maxDropQuality`/`maxDropGrade`. `table` and `column` are always drawn from
 * the fixed internal literals/whitelist above — never request input — so
 * interpolating them as raw identifiers is safe.
 */
async function applyLocalizedNames(
  tx: Prisma.TransactionClient,
  table: 'Equipment' | 'Junk',
  column: string,
  namesByEnglishName: ReadonlyMap<string, string>,
): Promise<void> {
  if (namesByEnglishName.size === 0) {
    return;
  }

  const values = [...namesByEnglishName].map(([englishName, localizedName]) => Prisma.sql`(
    ${englishName}, ${localizedName}
  )`);

  await tx.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)} AS t
    SET ${Prisma.raw(`"${column}"`)} = v.localizedName
    FROM (VALUES ${Prisma.join(values)}) AS v(englishName, localizedName)
    WHERE t."name" = v.englishName
  `;
}

/**
 * Scrapes and applies localized (`ja`/`ko`/`de`) junk + equipment display
 * names, one language at a time. Each language is fully isolated — a fetch
 * failure, parse failure, or failed alignment for one language is caught,
 * logged, and recorded in `LanguageStatus`; it never aborts the seed or the
 * remaining languages, since English (already seeded before this runs) is the
 * source of truth the app can always fall back to. See docs/domain.md's
 * "Localized names" section for the alignment approach.
 *
 * `englishParsedJunk` is the already-parsed English "Drop Rates by Junk"
 * result from the main seed pass — reused here (not re-fetched) so English is
 * parsed exactly once and every language aligns against the same rows.
 */
export async function seedLocalizedNames(
  prisma: PrismaClient,
  englishParsedJunk: ParseDropRatesByJunkResult,
  { baseUrl, junkUri }: SeedLocalizedNamesOptions,
): Promise<void> {
  for (const lang of LOCALIZED_LANGUAGES) {
    const checkedAt = new Date();

    try {
      const url = buildDropRateSourceUrl(baseUrl, lang, junkUri);
      console.log(`[seed] [${lang}] loading junk drop rates from: ${url}`);
      const html = await loadHtml(url);

      const parsed = parseDropRatesByJunk(html, { validateHeaders: false, lenientSections: true });
      const alignment = alignLocalizedNames(englishParsedJunk.rows, parsed.rows);

      if (!alignment.aligned) {
        console.warn(`[seed] [${lang}] not aligned with English (${alignment.reason}) — `
          + 'keeping any previously-synced names and marking this language out of sync.');
        await prisma.languageStatus.upsert({
          where: { lang },
          update: { isInSync: false, lastCheckedAt: checkedAt },
          create: { lang, isInSync: false, lastCheckedAt: checkedAt, lastSyncedAt: null },
        });
        continue;
      }

      const column = LOCALIZED_NAME_COLUMN[lang];
      await prisma.$transaction(async (tx) => {
        await applyLocalizedNames(tx, 'Equipment', column, alignment.equipmentNames);
        await applyLocalizedNames(tx, 'Junk', column, alignment.junkNames);
        await tx.languageStatus.upsert({
          where: { lang },
          update: { isInSync: true, lastSyncedAt: checkedAt, lastCheckedAt: checkedAt },
          create: { lang, isInSync: true, lastSyncedAt: checkedAt, lastCheckedAt: checkedAt },
        });
      }, { timeout: 60_000 });

      console.log(`[seed] [${lang}] aligned — wrote ${alignment.equipmentNames.size} equipment name(s) `
        + `and ${alignment.junkNames.size} junk name(s).`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[seed] [${lang}] failed to sync (${reason}) — `
        + 'keeping any previously-synced names and marking this language out of sync.');
      await prisma.languageStatus.upsert({
        where: { lang },
        update: { isInSync: false, lastCheckedAt: checkedAt },
        create: { lang, isInSync: false, lastCheckedAt: checkedAt, lastSyncedAt: null },
      });
    }
  }
}
