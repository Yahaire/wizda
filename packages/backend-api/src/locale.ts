import { NextFunction, Request, Response } from 'express';

import { isLanguageCode, LanguageCode, SOURCE_LANGUAGE } from '@shared/domain/language';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The resolved locale for this request — see `localeMiddleware`. Always a known `LanguageCode`. */
      locale: LanguageCode;
    }
  }
}

const LOCALE_QUERY_PARAM = 'lang';
const LOCALE_COOKIE_NAME = 'lang';

/**
 * Picks the highest-priority recognised language out of an `Accept-Language`
 * header (e.g. `"ja,en-US;q=0.9,en;q=0.8"`), matching on the primary subtag
 * only (`en-US` -> `en`) since we don't distinguish regional variants.
 */
function parseAcceptLanguage(header: string | undefined): LanguageCode | undefined {
  if (!header) {
    return undefined;
  }

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
      return { primarySubtag: (tag ?? '').trim().split('-')[0]!.toLowerCase(), quality };
    })
    .sort((a, b) => b.quality - a.quality);

  return ranked.map((entry) => entry.primarySubtag).find(isLanguageCode);
}

/** Reads one cookie's value out of a raw `Cookie` header, without an external cookie-parser dependency. */
function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return undefined;
}

/**
 * Resolves the request's locale and attaches it to `req.locale`. Priority
 * order: `?lang=` query param -> `lang` cookie -> `Accept-Language` header ->
 * {@link SOURCE_LANGUAGE} (English) as the default. An unrecognised value at
 * any step falls through to the next, rather than rejecting the request — an
 * unsupported/malformed locale should never break a page, it should just show
 * English.
 *
 * Sets `Vary` on the response so any future caching layer keys on the same
 * signals this middleware reads. Mounted globally in `index.ts`, ahead of
 * every router.
 */
export function localeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const queryLang = req.query[LOCALE_QUERY_PARAM];
  const fromQuery = typeof queryLang === 'string' && isLanguageCode(queryLang) ? queryLang : undefined;

  const cookieValue = readCookie(req.headers.cookie, LOCALE_COOKIE_NAME);
  const fromCookie = cookieValue !== undefined && isLanguageCode(cookieValue) ? cookieValue : undefined;

  const fromHeader = parseAcceptLanguage(req.headers['accept-language']);

  req.locale = fromQuery ?? fromCookie ?? fromHeader ?? SOURCE_LANGUAGE;

  res.setHeader('Vary', 'Accept-Language, Cookie');
  next();
}
