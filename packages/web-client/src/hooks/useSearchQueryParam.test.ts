import { describe, expect, it } from 'vitest';

import { buildSearchUrl } from './useSearchQueryParam';

describe('buildSearchUrl', () => {
  it('adds the query param to a bare path', () => {
    expect(buildSearchUrl('/en/junks', '', '', 'fordraig')).toBe('/en/junks?q=fordraig');
  });

  it('deletes the param entirely on a blank query, rather than leaving `?q=`', () => {
    expect(buildSearchUrl('/en/junks', '?q=fordraig', '', '')).toBe('/en/junks');
  });

  it('overwrites an existing q param', () => {
    expect(buildSearchUrl('/en/junks', '?q=old', '', 'new')).toBe('/en/junks?q=new');
  });

  it('preserves other params untouched', () => {
    expect(buildSearchUrl('/en/junks', '?foo=bar', '', 'fordraig')).toBe('/en/junks?foo=bar&q=fordraig');
  });

  it('preserves the hash', () => {
    expect(buildSearchUrl('/en/junks', '', '#section', 'fordraig')).toBe('/en/junks?q=fordraig#section');
  });

  it('URL-encodes the query', () => {
    expect(buildSearchUrl('/en/junks', '', '', 'heat haze')).toBe('/en/junks?q=heat+haze');
  });

  it('round-trips a Japanese query', () => {
    const url = buildSearchUrl('/ja/junks', '', '', 'よる');
    expect(new URLSearchParams(url.split('?')[1]).get('q')).toBe('よる');
  });
});
