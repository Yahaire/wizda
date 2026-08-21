import { useSearchParams } from 'next/navigation';
import { useCallback, useRef } from 'react';

/** The query-string key a shareable list search rides under, e.g. `?q=fordraig`. */
export const SEARCH_QUERY_PARAM = 'q';

/**
 * Rebuilds a URL with `query` written into its `SEARCH_QUERY_PARAM`, preserving
 * every other param and the hash — so mirroring the search box into the URL
 * never clobbers anything else that lands there later. A blank query deletes
 * the param entirely rather than writing `?q=`, so clearing the search box
 * cleans the address bar back up.
 *
 * Pure and DOM-free so it's unit-testable without a browser.
 */
export function buildSearchUrl(pathname: string, search: string, hash: string, query: string): string {
  const params = new URLSearchParams(search);
  if (query) {
    params.set(SEARCH_QUERY_PARAM, query);
  } else {
    params.delete(SEARCH_QUERY_PARAM);
  }
  const nextSearch = params.toString();
  return `${pathname}${nextSearch ? `?${nextSearch}` : ''}${hash}`;
}

interface SearchQueryParam {
  /** The `?q=` value this page loaded with — read once, for seeding a search box. */
  initialQuery: string,
  /**
   * Mirrors a query into the URL via `history.replaceState` (never `pushState` —
   * the debounce that calls this fires mid-word on slow typing, and a history
   * entry per keystroke would make Back useless). Stable across renders.
   */
  syncQueryToUrl: (query: string) => void,
}

/**
 * The URL↔search-box contract shared by the junk and equipment lists: seed the
 * box from `?q=` on mount, and keep the address bar in sync as the box changes
 * — which is what makes a search copy-and-shareable, and what an OpenSearch
 * `Url` template (`opensearch.xml`) lands a query on. See `docs/search.md`.
 *
 * `replaceState` rather than Next's router: App Router has no shallow routing,
 * so `router.replace` would re-run this route's render on every debounce tick.
 */
export function useSearchQueryParam(): SearchQueryParam {
  const searchParams = useSearchParams();

  // Pinned on first render only — after mount the search box owns its own
  // value, so a later change to the URL (e.g. Back) must not fight the input.
  const initialQueryRef = useRef<string | null>(null);
  if (initialQueryRef.current === null) {
    initialQueryRef.current = searchParams.get(SEARCH_QUERY_PARAM) ?? '';
  }

  const syncQueryToUrl = useCallback((query: string) => {
    const next = buildSearchUrl(window.location.pathname, window.location.search, window.location.hash, query);
    window.history.replaceState(window.history.state, '', next);
  }, []);

  return { initialQuery: initialQueryRef.current, syncQueryToUrl };
}
