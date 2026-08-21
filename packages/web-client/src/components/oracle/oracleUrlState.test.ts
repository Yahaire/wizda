import { describe, expect, it } from 'vitest';

import {
    DEFAULT_CERTAINTY_PCT, EMPTY_FILTERS, MAX_CERTAINTY_PCT, MAX_LEVEL, MIN_LEVEL
} from './oracle.logic';
import {
    buildJunkUrl, buildOracleUrl, buildShareableOracleUrl, filtersEqual, filtersFromParams,
    filtersToParams, junkFromParams, MAX_SHAREABLE_URL_LENGTH
} from './oracleUrlState';

import type { OracleFilters } from './oracle.logic';

describe('filtersToParams', () => {
  it('omits every axis at its default', () => {
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('never emits certainty, even when it differs from the default', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, certaintyPct: 95 });
    expect(params.has('certainty')).toBe(false);
  });

  it('repeats the key for multi-value axes, slugified', () => {
    const params = filtersToParams({
      ...EMPTY_FILTERS,
      category: ['CESTI', 'TWO_HANDED_AXE'],
      rank: ['SILVER'],
      blessings: ['ATK', 'ATK_PER'],
    });
    expect(params.getAll('category')).toEqual(['cesti', 'two-handed-axe']);
    expect(params.getAll('rank')).toEqual(['silver']);
    expect(params.getAll('blessings')).toEqual(['atk', 'atk-per']);
  });

  it('leaves equipment names unslugified — they are display strings, not codes', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, equipment: ['Ring of the Warrior Princess'] });
    expect(params.getAll('equipment')).toEqual(['Ring of the Warrior Princess']);
  });

  it('writes quality/grade only when above the "any" minimum', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, minQuality: 3, minGrade: MIN_LEVEL });
    expect(params.get('quality')).toBe('3');
    expect(params.has('grade')).toBe(false);
  });
});

describe('filtersFromParams', () => {
  it('returns null when none of the six filter keys are present', () => {
    expect(filtersFromParams(new URLSearchParams(''), DEFAULT_CERTAINTY_PCT)).toBeNull();
  });

  it('returns null for a lone certainty param — certainty alone is not a query, mirroring hasAnyFilter', () => {
    expect(filtersFromParams(new URLSearchParams('certainty=95'), DEFAULT_CERTAINTY_PCT)).toBeNull();
  });

  it('round-trips a real selection through filtersToParams', () => {
    const original: OracleFilters = {
      equipment: [],
      category: ['CESTI', 'TWO_HANDED_AXE'],
      rank: ['SILVER', 'EBONSTEEL'],
      minQuality: 4,
      minGrade: 3,
      blessings: ['ATK', 'SUR'],
      certaintyPct: 90,
    };
    const params = filtersToParams(original);
    // certainty never rides the URL, so the fallback stands in for it here —
    // that's the recipient's own setting in the real flow, see docs/sharing.md.
    expect(filtersFromParams(params, original.certaintyPct)).toEqual(original);
  });

  it('falls back to the caller-supplied certainty when the URL carries none', () => {
    const parsed = filtersFromParams(new URLSearchParams('category=cesti'), 77);
    expect(parsed?.certaintyPct).toBe(77);
  });

  it('parses and clamps a certainty the URL does carry, ignoring the fallback', () => {
    const parsed = filtersFromParams(new URLSearchParams('category=cesti&certainty=94.99'), DEFAULT_CERTAINTY_PCT);
    expect(parsed?.certaintyPct).toBe(94.99);
  });

  describe('hostile input', () => {
    it('clamps an out-of-range quality to the max level', () => {
      const parsed = filtersFromParams(new URLSearchParams('quality=99'), DEFAULT_CERTAINTY_PCT);
      expect(parsed?.minQuality).toBe(MAX_LEVEL);
    });

    it('falls back a non-numeric quality to "any"', () => {
      const parsed = filtersFromParams(new URLSearchParams('quality=abc'), DEFAULT_CERTAINTY_PCT);
      expect(parsed?.minQuality).toBe(MIN_LEVEL);
    });

    it('drops an unknown rank kind', () => {
      const parsed = filtersFromParams(new URLSearchParams('rank=notarank'), DEFAULT_CERTAINTY_PCT);
      expect(parsed?.rank).toEqual([]);
    });

    it('drops an unknown category code', () => {
      const parsed = filtersFromParams(new URLSearchParams('category=not-real'), DEFAULT_CERTAINTY_PCT);
      expect(parsed?.category).toEqual([]);
    });

    it('drops an unknown blessing code', () => {
      const parsed = filtersFromParams(new URLSearchParams('blessings=not-real'), DEFAULT_CERTAINTY_PCT);
      expect(parsed?.blessings).toEqual([]);
    });

    it('clamps an out-of-range certainty into bounds', () => {
      const parsed = filtersFromParams(new URLSearchParams('category=cesti&certainty=500'), DEFAULT_CERTAINTY_PCT);
      expect(parsed?.certaintyPct).toBe(MAX_CERTAINTY_PCT);
    });

    it('falls back a non-numeric certainty to the caller-supplied value', () => {
      const parsed = filtersFromParams(new URLSearchParams('category=cesti&certainty=abc'), 42);
      expect(parsed?.certaintyPct).toBe(42);
    });
  });
});

describe('buildOracleUrl', () => {
  it('preserves unrelated params and the hash', () => {
    const url = buildOracleUrl(
      '/en/junk-oracle',
      '?utm_source=reddit',
      '#section',
      { ...EMPTY_FILTERS, category: ['CESTI'] },
    );
    expect(url).toBe('/en/junk-oracle?utm_source=reddit&category=cesti#section');
  });

  it('clears every owned key, including a stray certainty and junk, when filters is null', () => {
    const url = buildOracleUrl(
      '/en/junk-oracle',
      '?category=cesti&certainty=95&junk=Some+Junk&utm_source=reddit',
      '',
      null,
    );
    expect(url).toBe('/en/junk-oracle?utm_source=reddit');
  });

  it('drops a stray certainty from a hand-built link even when writing filters', () => {
    const url = buildOracleUrl('/en/junk-oracle', '?certainty=95', '', { ...EMPTY_FILTERS, category: ['CESTI'] });
    expect(url).toBe('/en/junk-oracle?category=cesti');
  });

  it('closes an open detail modal on a fresh Calculate — junk is owned, like certainty', () => {
    const url = buildOracleUrl(
      '/en/junk-oracle',
      '?junk=Some+Junk',
      '',
      { ...EMPTY_FILTERS, category: ['CESTI'] },
    );
    expect(url).toBe('/en/junk-oracle?category=cesti');
  });
});

describe('junkFromParams', () => {
  it('reads the junk param', () => {
    expect(junkFromParams(new URLSearchParams('junk=Fordraig%27s+Junk'))).toBe("Fordraig's Junk");
  });

  it('returns null when absent', () => {
    expect(junkFromParams(new URLSearchParams('category=cesti'))).toBeNull();
  });
});

describe('buildJunkUrl', () => {
  it('sets junk while preserving the query already in the URL', () => {
    const url = buildJunkUrl('/en/junk-oracle', '?category=cesti', '', 'Some Junk');
    expect(url).toBe('/en/junk-oracle?category=cesti&junk=Some+Junk');
  });

  it('clears junk without touching the rest of the query', () => {
    const url = buildJunkUrl('/en/junk-oracle', '?category=cesti&junk=Some+Junk', '', null);
    expect(url).toBe('/en/junk-oracle?category=cesti');
  });

  it('preserves the hash', () => {
    const url = buildJunkUrl('/en/junk-oracle', '', '#section', 'Some Junk');
    expect(url).toBe('/en/junk-oracle?junk=Some+Junk#section');
  });
});

describe('filtersEqual', () => {
  it('is true for the same selection', () => {
    const a: OracleFilters = { ...EMPTY_FILTERS, category: ['CESTI'], minQuality: 3 };
    const b: OracleFilters = { ...EMPTY_FILTERS, category: ['CESTI'], minQuality: 3 };
    expect(filtersEqual(a, b)).toBe(true);
  });

  it('ignores certainty — it never rides the URL and never changes which junks appear', () => {
    const a: OracleFilters = { ...EMPTY_FILTERS, category: ['CESTI'], certaintyPct: 90 };
    const b: OracleFilters = { ...EMPTY_FILTERS, category: ['CESTI'], certaintyPct: 42 };
    expect(filtersEqual(a, b)).toBe(true);
  });

  it('is false for a genuinely different query', () => {
    const a: OracleFilters = { ...EMPTY_FILTERS, category: ['CESTI'] };
    const b: OracleFilters = { ...EMPTY_FILTERS, category: ['ODACHI'] };
    expect(filtersEqual(a, b)).toBe(false);
  });
});

describe('buildShareableOracleUrl', () => {
  it('fits an ordinary query and returns it unchanged', () => {
    const filters: OracleFilters = { ...EMPTY_FILTERS, category: ['CESTI'], minQuality: 3 };
    const result = buildShareableOracleUrl('/en/junk-oracle', '', '', filters);
    expect(result).toEqual({ url: buildOracleUrl('/en/junk-oracle', '', '', filters), fit: true });
  });

  it('falls back to a params-less URL, never a truncated one, when equipment pushes the query over the cap', () => {
    const hugeEquipment = Array.from(
      { length: 100 },
      (_unused, index) => `Some Very Long Equipment Name Number ${index}`,
    );
    const filters: OracleFilters = { ...EMPTY_FILTERS, equipment: hugeEquipment };

    const full = buildOracleUrl('/en/junk-oracle', '', '', filters);
    expect(full.length).toBeGreaterThan(MAX_SHAREABLE_URL_LENGTH);

    const result = buildShareableOracleUrl('/en/junk-oracle', '', '', filters);
    expect(result.fit).toBe(false);
    expect(result.url).toBe('/en/junk-oracle');
    expect(result.url.length).toBeLessThanOrEqual(MAX_SHAREABLE_URL_LENGTH);
  });

  it('preserves unrelated params on the params-less fallback', () => {
    const hugeEquipment = Array.from({ length: 100 }, (_unused, index) => `Equipment Name Number ${index}`);
    const filters: OracleFilters = { ...EMPTY_FILTERS, equipment: hugeEquipment };
    const result = buildShareableOracleUrl('/en/junk-oracle', '?utm_source=reddit', '', filters);
    expect(result.fit).toBe(false);
    expect(result.url).toBe('/en/junk-oracle?utm_source=reddit');
  });
});
