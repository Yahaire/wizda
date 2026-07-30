import { describe, expect, it } from 'vitest';

import {
    localeFromPath, localeHref, parseAcceptLanguage, stripLocale, swapLocalePath
} from './locale';

describe('localeFromPath', () => {
  it('reads a locale prefix', () => {
    expect(localeFromPath('/ja/junks')).toBe('ja');
    expect(localeFromPath('/en')).toBe('en');
  });

  it('returns null for a path that names no language', () => {
    expect(localeFromPath('/junks')).toBeNull();
    expect(localeFromPath('/')).toBeNull();
  });

  it('does not treat a language we do not offer as a prefix', () => {
    // `ko`/`de` are scraped for display names but have no UI catalog, so
    // `/ko/junks` must 404 rather than render a half-translated page.
    expect(localeFromPath('/ko/junks')).toBeNull();
    expect(localeFromPath('/fr')).toBeNull();
  });

  it('does not match a locale appearing later in the path', () => {
    expect(localeFromPath('/junks/ja')).toBeNull();
  });
});

describe('stripLocale', () => {
  it('removes the prefix', () => {
    expect(stripLocale('/ja/junks')).toBe('/junks');
    expect(stripLocale('/en/about')).toBe('/about');
  });

  it('maps a bare locale to the home path', () => {
    expect(stripLocale('/ja')).toBe('/');
    expect(stripLocale('/en')).toBe('/');
  });

  it('leaves an unprefixed path alone', () => {
    expect(stripLocale('/junks')).toBe('/junks');
    expect(stripLocale('/')).toBe('/');
  });
});

describe('localeHref', () => {
  it('prefixes an in-app path', () => {
    expect(localeHref('ja', '/junks')).toBe('/ja/junks');
  });

  it('renders home as a bare locale, with no trailing slash', () => {
    expect(localeHref('ja', '/')).toBe('/ja');
  });

  it('carries a hash along, since it follows the path', () => {
    expect(localeHref('ja', '/about#data-privacy')).toBe('/ja/about#data-privacy');
  });
});

describe('swapLocalePath', () => {
  it('moves a route to the other language', () => {
    expect(swapLocalePath('/en/junks', 'ja')).toBe('/ja/junks');
    expect(swapLocalePath('/ja/about', 'en')).toBe('/en/about');
  });

  it('keeps the visitor on the same route rather than sending them home', () => {
    expect(swapLocalePath('/ja/equipment', 'en')).toBe('/en/equipment');
  });

  it('handles the home route', () => {
    expect(swapLocalePath('/en', 'ja')).toBe('/ja');
  });

  it('prefixes a path that had none', () => {
    expect(swapLocalePath('/junks', 'ja')).toBe('/ja/junks');
  });
});

describe('parseAcceptLanguage', () => {
  it('picks the highest-quality offered language', () => {
    expect(parseAcceptLanguage('ja,en-US;q=0.9,en;q=0.8')).toBe('ja');
    expect(parseAcceptLanguage('en-US,en;q=0.9')).toBe('en');
  });

  it('matches on the primary subtag, ignoring the region', () => {
    expect(parseAcceptLanguage('ja-JP')).toBe('ja');
  });

  it('respects q-values over source order', () => {
    expect(parseAcceptLanguage('en;q=0.5,ja;q=0.9')).toBe('ja');
  });

  it('skips languages we scrape but do not have a UI catalog for', () => {
    expect(parseAcceptLanguage('ko,de;q=0.9')).toBeNull();
    expect(parseAcceptLanguage('ko,ja;q=0.5')).toBe('ja');
  });

  it('returns null for a missing or unusable header', () => {
    expect(parseAcceptLanguage(null)).toBeNull();
    expect(parseAcceptLanguage('')).toBeNull();
    expect(parseAcceptLanguage('*')).toBeNull();
  });
});
