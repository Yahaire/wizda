/**
 * The language set the drop-rate scrape supports, and which one is
 * authoritative.
 *
 * wizardry.info publishes the same "Drop Rates by Junk" page per language at
 * `<base>/<lang>/<uri>` (see `OFFICIAL_DROP_RATE_LIST_BASE_URL` +
 * `OFFICIAL_JUNK_DROP_RATES_URI`). English is the source of truth: every
 * `Equipment`/`Junk` row is keyed by its English `name` (see schema.prisma),
 * and the localized pages only ever contribute display names for rows the
 * English page already created. See docs/domain.md's "Localized names"
 * section for the alignment approach. Single source of truth for the language
 * set consumed by both the seed and the API.
 */

/**
 * The languages the app knows about. Mirror of the Prisma `LanguageCode` enum
 * in schema.prisma (keep the two in sync).
 *
 * The **values** are lowercase ISO 639-1 codes — unlike `EquipmentRankKind` /
 * `StatKind`, whose values are our own UPPERCASE vocabulary. These codes are
 * used verbatim as URL path segments (`gacha_rates/<lang>/...`), `?lang=`
 * values, cookie values, and `Accept-Language` subtags, so the value *is* the
 * wire format and must stay lowercase. The member names stay UPPERCASE to match
 * the house style (`LanguageCode.EN === 'en'`); Prisma can't express that split
 * (a member name there *is* the stored value), so its members read lowercase.
 *
 * Deliberately a `const` object + derived union rather than a TS `enum` (which
 * `EquipmentRankKind` / `StatKind` use): TS string enums are *nominal*, but
 * Prisma 7 generates its enums as plain unions — so a value read back from the
 * DB (typed `'en'`) would not be assignable to a TS `enum` without a cast at
 * every Prisma boundary. This shape is structurally identical to what Prisma
 * generates, so it needs no casts while staying just as type-safe.
 */
export const LanguageCode = {
  EN: 'en',
  JA: 'ja',
  KO: 'ko',
  DE: 'de',
} as const;

export type LanguageCode = (typeof LanguageCode)[keyof typeof LanguageCode];

/** The language the whole data model is keyed by. */
export const SOURCE_LANGUAGE = LanguageCode.EN;

/** Any language that is *not* the source — i.e. one that carries display names only. */
export type LocalizedLanguage = Exclude<LanguageCode, typeof SOURCE_LANGUAGE>;

/** Languages the seed additionally scrapes for display names only. */
export const LOCALIZED_LANGUAGES: readonly LocalizedLanguage[] = [
  LanguageCode.JA,
  LanguageCode.KO,
  LanguageCode.DE,
];

/** Every language code, source first — the canonical iteration/display order. */
export const ALL_LANGUAGES: readonly LanguageCode[] = [SOURCE_LANGUAGE, ...LOCALIZED_LANGUAGES];

/**
 * Type guard for untrusted input (a `?lang=` param, a cookie, an
 * `Accept-Language` subtag). Values read back out of our own DB don't need it —
 * the `LanguageCode` column constrains them already.
 */
export function isLanguageCode(value: string): value is LanguageCode {
  return (ALL_LANGUAGES as readonly string[]).includes(value);
}
