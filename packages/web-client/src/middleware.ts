import { NextResponse } from 'next/server';

import {
    DEFAULT_LANGUAGE, isSupportedLanguage, LOCALE_COOKIE_NAME, localeFromPath, localeHref,
    parseAcceptLanguage
} from '@/i18n/locale';

import type { NextRequest } from 'next/server';

/**
 * Sends language-less URLs to a locale-prefixed one. `/junks` -> `/en/junks`
 * or `/ja/junks`; `/` -> `/en` or `/ja`.
 *
 * **The path always wins.** A URL that already names a locale is passed
 * through untouched, cookie or not — otherwise a shared `/ja/junks` link would
 * open in the recipient's language and the URL would be lying about what it
 * shows. The cookie only answers URLs that name no language at all.
 *
 * Resolution order mirrors `backend-api/src/locale.ts`: explicit preference
 * (the cookie, written only by a real toggle click) -> `Accept-Language` ->
 * English. Googlebot sends `Accept-Language: en` and carries no cookie, so it
 * lands deterministically on `/en/…`, which is what consolidates the indexing
 * that the pre-split URLs already have.
 *
 * See `docs/i18n.md`.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (localeFromPath(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const fromCookie = cookieValue && isSupportedLanguage(cookieValue) ? cookieValue : null;
  const fromHeader = parseAcceptLanguage(request.headers.get('accept-language'));
  const lang = fromCookie ?? fromHeader ?? DEFAULT_LANGUAGE;

  const target = new URL(`${localeHref(lang, pathname)}${search}`, request.url);

  // 307, never 301. A permanent redirect is cached by browsers more or less
  // forever, so a visitor who later picks the other language would keep being
  // sent to the old one without this middleware ever running again — the
  // toggle would look broken with nothing in the logs to show why. Any
  // redirect whose target varies per visitor has to be temporary.
  const response = NextResponse.redirect(target, 307);
  response.headers.set('Vary', 'Accept-Language, Cookie');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - `/api/*`      — proxied to the backend by a rewrite; has its own locale handling
     * - `/umami/*`    — the analytics first-party proxy
     * - `/_next/*`    — build output
     * - `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js` — well-known
     *   paths that must stay at the root; a locale prefix would break them
     * - anything with a file extension (icons, images, the precache manifest)
     */
    '/((?!api|umami|_next|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|sw\\.js|.*\\.[\\w]+$).*)',
  ],
};
