import { LanguageCode, LocalizedLanguage, SOURCE_LANGUAGE } from '@shared/domain/language';

/** Shape of a Prisma `select` that carries the English name plus the three localized columns. */
export interface LocalizableNameRow {
  name: string;
  nameJa: string | null;
  nameKo: string | null;
  nameDe: string | null;
}

const LOCALIZED_NAME_FIELD: Readonly<Record<LocalizedLanguage, keyof LocalizableNameRow>> = {
  ja: 'nameJa',
  ko: 'nameKo',
  de: 'nameDe',
};

/**
 * Resolves the display name for `row` in `locale`: the localized column when
 * one is set, else the English `name` — covers both `locale === SOURCE_LANGUAGE`
 * and a localized language whose translation for this row is missing or has
 * never synced (see `LanguageStatus`). `name` itself stays the API's stable,
 * never-localized key (see docs/domain.md's "Localized names" section) —
 * callers pass it through separately; this only ever produces the *display*
 * string.
 */
export function pickLocalizedName(row: LocalizableNameRow, locale: LanguageCode): string {
  if (locale === SOURCE_LANGUAGE) {
    return row.name;
  }
  return row[LOCALIZED_NAME_FIELD[locale]] ?? row.name;
}
