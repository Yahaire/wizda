import { LanguageCode } from '@shared/domain/language';

/**
 * Everything needed to answer "which language is this request/route in" —
 * deliberately a **leaf module**: it imports no string or Wizda-voice catalog.
 * `middleware.ts` runs in its own bundle and only needs to resolve a locale, so
 * pulling `languageStore` (which holds the catalog registries) in there would
 * drag both languages' full text into the middleware chunk for nothing.
 *
 * The catalogs and the module-level mirror live in `languageStore.ts`, which
 * builds on this.
 */

/**
 * The languages this app actually offers a switcher for today — a subset of
 * the backend's full `LanguageCode` (which also knows `ko`/`de`, still
 * scraped for display names but not yet given a UI-chrome or Wizda-voice
 * catalog). Add a language here once its `strings.<lang>.ts` and
 * `voice.<lang>.ts` catalogs exist; see `docs/i18n.md` for the full checklist.
 */
export type SupportedLanguage = Extract<LanguageCode, 'en' | 'ja'>;

export const OFFERED_LANGUAGES: readonly SupportedLanguage[] = [
  LanguageCode.EN,
  LanguageCode.JA,
];

/** Used wherever no other signal resolves — and what Googlebot lands on. */
export const DEFAULT_LANGUAGE: SupportedLanguage = LanguageCode.EN;

/**
 * Remembers an *explicit* toggle click, and nothing else. Never written by
 * language auto-detection, so a visitor who never touches the switcher stores
 * nothing at all. Only consulted for language-less URLs — a `/en` or `/ja`
 * path always wins over it (see `docs/i18n.md`).
 *
 * Namespaced rather than plain `lang` so it can't collide with the backend's
 * own `lang` cookie, which is same-origin via the `/api/*` rewrite.
 */
export const LOCALE_COOKIE_NAME = 'wizda.lang';

/** One year — a UI preference, not a session. */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Each language's own name for itself — always shown in that language, never translated. */
export const LANGUAGE_ENDONYMS: Record<SupportedLanguage, string> = {
  en: 'English',
  ja: '日本語',
};

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (OFFERED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * The locale a path is already prefixed with, or `null` when it carries none.
 * `/ja/junks` -> `ja`; `/junks` -> `null`.
 */
export function localeFromPath(pathname: string): SupportedLanguage | null {
  const firstSegment = pathname.split('/')[1] ?? '';
  return isSupportedLanguage(firstSegment) ? firstSegment : null;
}

/**
 * A path with its locale prefix removed, always leading with `/`.
 * `/ja/junks` -> `/junks`; `/en` -> `/`; an unprefixed path is returned as-is.
 *
 * Use this for "which route am I on" comparisons — nav highlighting and the
 * like — so route checks never have to know about locales.
 */
export function stripLocale(pathname: string): string {
  const lang = localeFromPath(pathname);
  if (!lang) {
    return pathname;
  }
  // Measured off the matched code rather than assuming two characters, so a
  // future three-letter or region-qualified code doesn't silently truncate.
  const withoutLocale = pathname.slice(lang.length + 1);
  return withoutLocale.startsWith('/') ? withoutLocale : `/${withoutLocale}`;
}

/**
 * An unprefixed in-app path rendered under a locale — the form every internal
 * `href` must take. `/junks` + `ja` -> `/ja/junks`; `/` + `ja` -> `/ja`.
 * A trailing `#hash` or `?query` rides along untouched, since both follow the
 * path.
 */
export function localeHref(lang: SupportedLanguage, path: string): string {
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

/** The same route under a different locale — what the language switcher navigates to. */
export function swapLocalePath(pathname: string, lang: SupportedLanguage): string {
  return localeHref(lang, stripLocale(pathname));
}

/**
 * Picks the highest-priority *offered* language out of an `Accept-Language`
 * header (e.g. `"ja,en-US;q=0.9,en;q=0.8"`), matching on the primary subtag
 * only (`en-US` -> `en`) since we don't distinguish regional variants.
 *
 * Mirrors `backend-api/src/locale.ts`'s parser, but filtered to the languages
 * that have a UI catalog: a `ko` browser gets English here, even though the
 * backend would happily resolve `ko` display names.
 */
export function parseAcceptLanguage(header: string | null | undefined): SupportedLanguage | null {
  if (!header) {
    return null;
  }

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
      return {
        primarySubtag: (tag ?? '').trim().split('-')[0]!.toLowerCase(),
        quality: Number.isNaN(quality) ? 0 : quality,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  return ranked.map((entry) => entry.primarySubtag).find(isSupportedLanguage) ?? null;
}
