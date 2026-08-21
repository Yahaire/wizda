/**
 * Serializes/parses the Oracle's filter picks to and from `URLSearchParams` —
 * the shareable-link half of `docs/sharing.md`. Pure and DOM-free, mirroring
 * `useSearchQueryParam.ts`'s `buildSearchUrl`, so this is unit-testable
 * without a browser. Only `useOracleUrlState.ts` touches `window`.
 *
 * Keys match `GuaranteeFilters`' own field names (`equipment`, `rank`,
 * `category`, `blessings`) plus `quality`/`grade` for the two minimum axes, so
 * the URL, the API and the docs all speak one vocabulary. Values are
 * lowercased with underscores turned to hyphens (`TWO_HANDED_AXE` ->
 * `two-handed-axe`) — cosmetic, but it's what a reader sees pasted into a
 * Reddit comment. Equipment names ride through unslugified: they're arbitrary
 * display strings ("Ring of the Warrior Princess"), not codes.
 *
 * Multi-value axes repeat the key (`&blessings=atk&blessings=sur`) rather than
 * comma-joining a single value — `URLSearchParams.toString()` percent-encodes
 * a literal comma, which would make `%2C`-joined lists uglier than repetition
 * for no benefit.
 */

import {
    KNOWN_BLESSING_CODES, KNOWN_CATEGORY_CODES, KNOWN_RANK_KINDS, MAX_BLESSINGS, MAX_CERTAINTY_PCT,
    MAX_LEVEL, MIN_CERTAINTY_PCT, MIN_LEVEL
} from './oracle.logic';

import type { OracleFilters } from './oracle.logic';

/**
 * The accepted-outcome axes' param keys — everything `hasAnyFilter` checks.
 * `certainty` is handled separately (see the module doc): it's parsed when
 * present but never counted as "is this a shared link" and never written.
 */
const FILTER_PARAM_KEYS = ['equipment', 'category', 'rank', 'quality', 'grade', 'blessings'] as const;

/** Every param key this module owns — used to clear a stale value on write. */
const ALL_PARAM_KEYS = [...FILTER_PARAM_KEYS, 'certainty'] as const;

/**
 * The conservative cross-platform length a shared URL should stay under —
 * comfortably below the Apache `LimitRequestLine` the production deployment
 * sits behind (8190 bytes default), and short enough that autolinkers (Reddit,
 * Discord) don't truncate it mid-parameter. Only the `equipment` axis can push
 * a query past this: every other axis is small and bounded (33 categories, 6
 * ranks, 4 blessings, single-digit levels), but the equipment catalogue is 738
 * names deep with no cap on how many a player can pick.
 *
 * A URL over this cap is never truncated — that would silently hand the
 * recipient a *different*, shorter-but-valid query with no sign anything was
 * lost. See `useOracleUrlState.ts`'s `pushFilters` for what happens instead.
 */
export const MAX_SHAREABLE_URL_LENGTH = 2000;

function slugify(value: string): string {
  // `.replaceAll` would need an ES2021+ `lib`, which this workspace's
  // tsconfig doesn't carry (its `lib` override drops the base's `ES2022` —
  // see tsconfig.json) — a global regex replace sidesteps that.
  return value.toLowerCase().replace(/_/g, '-');
}

function unslugify(value: string): string {
  return value.toUpperCase().replace(/-/g, '_');
}

function clampLevelParam(raw: string | null): number {
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) {
    return MIN_LEVEL;
  }
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, parsed));
}

/**
 * The Oracle's picks as URL params, omitting every axis at its default (a
 * wildcard) and always omitting `certainty` — see the module doc.
 */
export function filtersToParams(filters: OracleFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const name of filters.equipment) {
    params.append('equipment', name);
  }
  for (const code of filters.category) {
    params.append('category', slugify(code));
  }
  for (const kind of filters.rank) {
    params.append('rank', slugify(kind));
  }
  if (filters.minQuality > MIN_LEVEL) {
    params.set('quality', String(filters.minQuality));
  }
  if (filters.minGrade > MIN_LEVEL) {
    params.set('grade', String(filters.minGrade));
  }
  for (const code of filters.blessings) {
    params.append('blessings', slugify(code));
  }

  return params;
}

/**
 * URL params back to `OracleFilters`, or `null` when none of the six
 * accepted-outcome keys are present at all — the signal that this URL wasn't
 * built by the share feature (a plain visit, or a link to some other axis
 * entirely). A lone `certainty` doesn't count, mirroring `hasAnyFilter`'s own
 * "certainty alone doesn't count" rule.
 *
 * Every value is validated and clamped rather than trusted — this is the one
 * place a hand-edited or stale link's junk becomes safe input. Equipment names
 * pass through unvalidated: the API 400s an unknown one, and the Oracle
 * already has a friendly line for that error.
 *
 * `certainty`, when present, is parsed and clamped into range; when absent,
 * `fallbackCertaintyPct` is used instead — the *recipient's own* setting
 * (pass the live `filters.certaintyPct`, not a fresh default), since a shared
 * link deliberately never carries the sharer's certainty. See `docs/sharing.md`.
 */
export function filtersFromParams(params: URLSearchParams, fallbackCertaintyPct: number): OracleFilters | null {
  const hasAnyKey = FILTER_PARAM_KEYS.some((key) => params.has(key));
  if (!hasAnyKey) {
    return null;
  }

  const equipment = [...new Set(params.getAll('equipment').map((name) => name.trim()).filter(Boolean))];

  const category = [...new Set(
    params.getAll('category').map(unslugify).filter((code) => KNOWN_CATEGORY_CODES.has(code)),
  )];

  const rank = [...new Set(
    params.getAll('rank').map(unslugify).filter((kind) => KNOWN_RANK_KINDS.has(kind)),
  )];

  const blessings = [...new Set(
    params.getAll('blessings').map(unslugify).filter((code) => KNOWN_BLESSING_CODES.has(code)),
  )].slice(0, MAX_BLESSINGS);

  const rawCertainty = params.get('certainty');
  const parsedCertainty = rawCertainty === null ? Number.NaN : Number.parseFloat(rawCertainty);
  const certaintyPct = Number.isFinite(parsedCertainty)
    ? Math.min(MAX_CERTAINTY_PCT, Math.max(MIN_CERTAINTY_PCT, parsedCertainty))
    : fallbackCertaintyPct;

  return {
    equipment,
    category,
    rank,
    minQuality: clampLevelParam(params.get('quality')),
    minGrade: clampLevelParam(params.get('grade')),
    blessings,
    certaintyPct,
  };
}

/**
 * Rebuilds a URL with the Oracle's own params replaced by `filters` (or
 * cleared entirely, when `filters` is `null`), preserving every unrelated
 * param and the hash — same contract as `useSearchQueryParam.ts`'s
 * `buildSearchUrl`. `certainty` is always dropped: a stray one from a
 * hand-built link a player is refining shouldn't survive their next
 * Calculate.
 *
 * Pure and DOM-free so it's unit-testable without a browser.
 */
export function buildOracleUrl(
  pathname: string,
  search: string,
  hash: string,
  filters: OracleFilters | null,
): string {
  const params = new URLSearchParams(search);
  for (const key of ALL_PARAM_KEYS) {
    params.delete(key);
  }
  if (filters) {
    for (const [key, value] of filtersToParams(filters)) {
      params.append(key, value);
    }
  }
  const nextSearch = params.toString();
  return `${pathname}${nextSearch ? `?${nextSearch}` : ''}${hash}`;
}

export interface ShareableOracleUrl {
  url: string,
  /** False when `filters` didn't fit — `url` is the params-less fallback instead. */
  fit: boolean,
}

/**
 * Same contract as `buildOracleUrl`, but never returns a URL over
 * {@link MAX_SHAREABLE_URL_LENGTH} — falls back to a params-less URL instead
 * of truncating (see the module doc's cap section for why truncation is
 * unacceptable here: it would silently hand the recipient a different,
 * shorter-but-valid query). `null` filters always fit trivially.
 *
 * This is what decides, not just what builds — kept pure and separate from
 * `useOracleUrlState.ts`'s `pushFilters` so the decision is testable without
 * a browser; the hook only carries the result to `window.history`.
 */
export function buildShareableOracleUrl(
  pathname: string,
  search: string,
  hash: string,
  filters: OracleFilters | null,
): ShareableOracleUrl {
  const full = buildOracleUrl(pathname, search, hash, filters);
  if (full.length <= MAX_SHAREABLE_URL_LENGTH) {
    return { url: full, fit: true };
  }
  return { url: buildOracleUrl(pathname, search, hash, null), fit: false };
}
