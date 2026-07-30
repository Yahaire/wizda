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

/** Shape of a Prisma `select` that carries the Japanese reading (see `Equipment.nameJaReading`). */
export interface ReadableNameRow {
  nameJaReading: string | null;
}

/**
 * Resolves the search-only reading for `row` in `locale`: the stored hiragana
 * reading of the Japanese name, or `undefined` for every other locale.
 *
 * Japanese is the only language that needs one — it writes a single name in
 * kanji, hiragana and katakana at once, so a player typing `よる` can't reach
 * `夜` by normalizing strings; only a stored reading bridges them. Hangul and
 * German are matched by the client's normalizer as-is, so `ko`/`de` have no
 * equivalent column.
 *
 * `undefined` (rather than `null`) so callers can spread it into a response and
 * have `JSON.stringify` drop the key entirely — the field is ~7 KB gzipped
 * across a full list, and English users should not pay for it. Display code must
 * never read this: it's a search aid, not a name.
 */
export function pickLocalizedReading(row: ReadableNameRow, locale: LanguageCode): string | undefined {
  if (locale !== LanguageCode.JA) {
    return undefined;
  }
  return row.nameJaReading ?? undefined;
}
