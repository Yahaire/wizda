import { LanguageCode } from '@shared/domain/language';

/**
 * Composes a per-language drop-rate page URL from the `OFFICIAL_*` env vars:
 * `<baseUrl>/<lang>/<uri>`, e.g.
 * `https://wizardry.info/daphne/gacha_rates/ja/equipments.html`. English uses
 * the same composition (`lang: 'en'`) so there's exactly one code path for
 * every language. `loadHtml` treats the result as a local file path when one
 * exists at that string, so a local mirror directory (`<base>/<lang>/<uri>`)
 * works transparently — same convention as the un-composed source vars before
 * this became multi-language.
 */
export function buildDropRateSourceUrl(baseUrl: string, lang: LanguageCode, uri: string): string {
  return `${baseUrl}/${lang}/${uri}`;
}
