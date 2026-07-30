import { DEFAULT_LANGUAGE, localeHref, OFFERED_LANGUAGES } from '@/i18n/locale';

import { SITE_URL } from './app.constants';
import { ROUTE_PATHS } from './pageMetadata';

import type { MetadataRoute } from 'next';

/**
 * One entry per route per language, each cross-referencing the others via
 * `alternates.languages` — the machine-readable half of the same `hreflang`
 * relationship the pages declare in their `<head>` (see `pageMetadata.ts`).
 *
 * Only prefixed URLs are listed. The language-less paths (`/`, `/junks`, …)
 * are 307 redirects, so they are not canonical and must not appear here.
 *
 * Adding a route means adding it to `ROUTE_PATHS`; this picks it up for free.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const absolute = (lang: (typeof OFFERED_LANGUAGES)[number], path: string) => (
    new URL(localeHref(lang, path), SITE_URL).toString()
  );

  return Object.values(ROUTE_PATHS).flatMap((routePath) => (
    OFFERED_LANGUAGES.map((lang) => ({
      url: absolute(lang, routePath),
      lastModified: new Date(),
      alternates: {
        languages: {
          ...Object.fromEntries(
            OFFERED_LANGUAGES.map((alternate) => [alternate, absolute(alternate, routePath)]),
          ),
          'x-default': absolute(DEFAULT_LANGUAGE, routePath),
        },
      },
    }))
  ));
}
