import { stringsFor } from '@/i18n/languageStore';
import { DEFAULT_LANGUAGE, localeHref, OFFERED_LANGUAGES } from '@/i18n/locale';

import { APP_NAME, SITE_URL } from './app.constants';

import type { SupportedLanguage } from '@/i18n/locale';
import type { UiStrings } from '@/i18n/strings';
import type { Metadata } from 'next';

/**
 * Builds a route's per-language `<title>`/`<meta description>` plus its
 * `hreflang` alternates, so every page advertises its counterpart in the other
 * languages. Shared by all four routes and by `sitemap.ts` — adding a route
 * means adding it to {@link ROUTE_PATHS} and to `UiStrings['meta']`, and both
 * the metadata and the sitemap pick it up.
 *
 * See `docs/i18n.md`.
 */

export type MetaRouteKey = keyof UiStrings['meta'];

/**
 * The unprefixed path each route lives at. Locale prefixes are added per
 * language.
 *
 * WARNING: If updating, must also update `middleware.ts` wherever the routes are
 * used as literals
 */
export const ROUTE_PATHS: Record<MetaRouteKey, string> = {
  oracle: '/junk-oracle',
  junks: '/junks',
  equipment: '/equipment',
  about: '/about',
};

/**
 * Every offered language's URL for a route, plus `x-default` pointing at the
 * default language — which is also where a language-less URL redirects, so the
 * two agree.
 */
export function alternateLanguageUrls(routePath: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const lang of OFFERED_LANGUAGES) {
    languages[lang] = localeHref(lang, routePath);
  }
  languages['x-default'] = localeHref(DEFAULT_LANGUAGE, routePath);
  return languages;
}

export function buildPageMetadata(lang: SupportedLanguage, route: MetaRouteKey): Metadata {
  const meta = stringsFor(lang).meta[route];
  const routePath = ROUTE_PATHS[route];

  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title(APP_NAME),
    description: meta.description,
    alternates: {
      canonical: localeHref(lang, routePath),
      languages: alternateLanguageUrls(routePath),
    },
  };
}
