import { NextResponse } from 'next/server';

import {
    DEFAULT_LANGUAGE, isSupportedLanguage, LOCALE_COOKIE_NAME, localeFromPath, localeHref,
    parseAcceptLanguage, stripLocale
} from '@/i18n/locale';

import type { NextRequest } from 'next/server';

/**
 * The Oracle's route. Kept as a literal here (rather than importing
 * `ROUTE_PATHS.oracle` from `app/pageMetadata.ts`) so this file — which runs on
 * every request — doesn't pull in that module's whole i18n string catalog for
 * one constant. Keep the two in sync by hand.
 */
const ORACLE_PATH = '/junk-oracle';

/**
 * Two jobs, both redirects:
 *
 * 1. **Language.** Sends language-less URLs to a locale-prefixed one.
 *    `/junks` -> `/en/junks` or `/ja/junks`.
 * 2. **The root.** Sends the site root — prefixed or not — to the Oracle.
 *    `/`, `/en`, `/ja` -> `/en{ORACLE_PATH}` / `/ja{ORACLE_PATH}`. The Oracle
 *    used to live at the root; a second tool is planned, at which point the
 *    root becomes a real homepage, so a link shared before that move must keep
 *    landing on the Oracle rather than silently start pointing at whatever
 *    replaces it.
 *
 * **The path always wins on language.** A URL that already names a locale only
 * ever gets redirected for (2) above; its language is passed through
 * untouched, cookie or not — otherwise a shared `/ja/junks` link would open in
 * the recipient's language and the URL would be lying about what it shows. The
 * cookie only answers URLs that name no language at all.
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

  const prefixLang = localeFromPath(pathname);
  if (prefixLang) {
    // Already on a locale — pass through, unless it's the bare root, which
    // still needs job (2) above. No language was negotiated here at all.
    if (stripLocale(pathname) !== '/') {
      return NextResponse.next();
    }
    return redirectTo(request, localeHref(prefixLang, ORACLE_PATH), search, { negotiatesLanguage: false });
  }

  const cookieValue = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const fromCookie = cookieValue && isSupportedLanguage(cookieValue) ? cookieValue : null;
  const fromHeader = parseAcceptLanguage(request.headers.get('accept-language'));
  const lang = fromCookie ?? fromHeader ?? DEFAULT_LANGUAGE;

  const targetPath = pathname === '/' ? ORACLE_PATH : pathname;
  return redirectTo(request, localeHref(lang, targetPath), search, { negotiatesLanguage: true });
}

/**
 * Can't use `request.url`/`request.nextUrl.origin` as the base here: in
 * production `next start` is given an explicit `-H 127.0.0.1 -p 4000` (to keep
 * the port loopback-only, see DEPLOY.md), and whenever Next is started with
 * both a hostname and a port it hardcodes every absolute URL it builds
 * internally to THAT bind address instead of the proxied request — so this
 * redirect's target would resolve to `http://localhost:4000/...` no matter
 * what Apache forwards. Reading the forwarded headers directly sidesteps it.
 */
function redirectTo(
  request: NextRequest,
  path: string,
  search: string,
  { negotiatesLanguage }: { negotiatesLanguage: boolean },
): NextResponse {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const origin = forwardedHost
    ? `${request.headers.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}`
    : request.nextUrl.origin;

  const target = new URL(`${path}${search}`, origin);

  // 307, never 301 for either redirect this serves. A permanent redirect is
  // cached by browsers more or less forever: for the language one, a visitor
  // who later picks the other language would keep landing on the old one with
  // nothing in the logs to show why; for the root-to-Oracle one, a permanently
  // cached redirect would strand returning visitors on the Oracle once the
  // future homepage exists and this rule is removed. Any redirect whose target
  // can change later has to be temporary.
  const response = NextResponse.redirect(target, 307);
  if (negotiatesLanguage) {
    response.headers.set('Vary', 'Accept-Language, Cookie');
  }
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
