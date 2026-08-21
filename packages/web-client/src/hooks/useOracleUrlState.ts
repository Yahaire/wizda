'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

import { buildJunkUrl, buildShareableOracleUrl } from '@/components/oracle/oracleUrlState';

import type { OracleFilters } from '@/components/oracle/oracle.logic';

/**
 * Marks a history entry as one this page itself pushed for an open junk
 * detail modal — see `closeJunk`. Spread onto `history.state` alongside
 * whatever App Router already keeps there, never replacing it.
 */
const JUNK_PUSH_MARKER = 'oracleJunkPush';

interface PushResult {
  /**
   * False when the query was too large to fit in a shareable link — see
   * `pushFilters`. The address bar is left exactly as it was in this case;
   * `fit` is only for the caller to steer the Share button toward the image
   * export instead.
   */
  fit: boolean,
}

interface OracleUrlState {
  /** The Oracle's params this page loaded with — read once, for the mount-time seed. */
  initialParams: URLSearchParams,
  /**
   * Pushes a fresh history entry for a completed query — Calculate (and
   * replaying a popular query) is a deliberate, discrete action that produces
   * a distinct, nameable state, so it earns an entry Back/Forward can walk.
   *
   * When the query is too large to fit in a shareable link (only an
   * unbounded `equipment` selection can do this — see
   * `MAX_SHAREABLE_URL_LENGTH`), the address bar is left untouched instead —
   * deliberately neither a push nor a `replaceState`. Two failure modes ruled
   * that out:
   *
   * - **Pushing** a bare fallback creates a real history entry that happens to
   *   share its URL with whatever came before. Repeat an oversized Calculate a
   *   few times (tweak a filter, Calculate, tweak, Calculate) and Back/Forward
   *   fills up with indistinguishable duplicate entries — `popstate` can't
   *   tell them apart, so every one of those in-between attempts becomes
   *   unreachable except by however long it happens to stay on screen.
   * - **Replacing** overwrites the *current* entry — which, if the last
   *   successful Calculate fit and pushed a real query URL, means turning a
   *   still-valid, still-shareable entry into a bare one. Back would then skip
   *   straight past a query that used to work.
   *
   * Doing nothing keeps the address bar a faithful "last shareable state" —
   * always either genuinely bare (nothing fit yet) or a real, replayable
   * query — at the cost of the on-screen oversized result not surviving a
   * refresh (it was never encodable in the first place; see `docs/sharing.md`).
   * Returns `fit: false` so the caller can steer the Share button toward the
   * image export instead.
   */
  pushFilters: (filters: OracleFilters) => PushResult,
  /**
   * Pushes a fresh, params-less history entry — the empty state reached via
   * the UI "Back" button. Deliberately a push, not `history.back()`: the
   * results panel is a destination, not a dismissable overlay (contrast the
   * junk detail modal), so Back off it should always land on the empty state
   * rather than replaying whatever query came before.
   */
  pushCleared: () => void,
  /**
   * Pushes a fresh history entry with `junk` set on top of whatever query is
   * already showing — opening the detail modal is a deliberate action
   * distinct from that query, so (like Calculate) it earns its own entry.
   * Marks the entry so `closeJunk` can tell it apart from one the visitor
   * landed on directly.
   */
  pushJunk: (junkName: string) => void,
  /**
   * Closes the modal. `history.back()` when the entry being left carries this
   * page's own marker (see `pushJunk`) — that undoes exactly the one entry
   * opening it added, and is what makes a phone's Back button close the modal
   * the same way this does. Otherwise (the visitor landed directly on a
   * `junk=` link, so Back would leave the site entirely) falls back to
   * `replaceState`, stripping `junk` in place instead.
   */
  closeJunk: () => void,
}

/**
 * The Oracle's URL↔state contract: `pushState` for Calculate, a native
 * `popstate` listener (not a `useSearchParams()` effect) for Back/Forward.
 *
 * This inverts both halves of the list views' `useSearchQueryParam` — on
 * purpose, and consistently rather than contradictorily: `replaceState` suits
 * a value that changes continuously (a search box, mid-keystroke), while
 * `pushState` suits a value that changes in discrete, deliberate steps worth
 * naming in history. Calculate is the latter.
 *
 * Still native `window.history`, not `router.push` — App Router has no
 * shallow routing, so `router.push` would re-run this route's render on every
 * call. Next keeps `useSearchParams()` in sync with native history writes.
 * `window.history.state` rides through untouched on every write (App Router
 * keeps its own internals there).
 *
 * `popstate` only fires on a user's own Back/Forward, never on our own
 * `pushState` calls — so there's no write-triggers-read-triggers-write loop
 * to guard against, unlike a `useSearchParams()` effect would need. The
 * *caller* owns applying a popped state (see `OraclePage`'s `applyUrlState`),
 * so the same code path handles "landed on a shared link" and "navigated
 * there via Back" — they're the same operation and must not drift into two.
 */
export function useOracleUrlState(onPopState: (params: URLSearchParams) => void): OracleUrlState {
  const searchParams = useSearchParams();

  // Pinned on first render only — this is the mount-time seed; after that the
  // popstate listener below is what tracks the URL.
  const initialParamsRef = useRef<URLSearchParams | null>(null);
  if (initialParamsRef.current === null) {
    initialParamsRef.current = new URLSearchParams(searchParams);
  }

  // `onPopState` closes over this render's state/handlers, which go stale the
  // moment anything re-renders — kept fresh via a ref updated every render
  // (not just once) rather than re-subscribing the DOM listener each time.
  const onPopStateRef = useRef(onPopState);
  useEffect(() => {
    onPopStateRef.current = onPopState;
  });

  useEffect(() => {
    const listener = () => {
      onPopStateRef.current(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  const push = useCallback((filters: OracleFilters | null): PushResult => {
    const { url, fit } = buildShareableOracleUrl(
      window.location.pathname,
      window.location.search,
      window.location.hash,
      filters,
    );
    // `filters: null` (pushCleared) always fits trivially, so this only ever
    // skips the write for an oversized `pushFilters` call — see the docs on
    // `pushFilters` above for why doing nothing beats push or replace here.
    if (fit) {
      window.history.pushState(window.history.state, '', url);
    }
    return { fit };
  }, []);

  const pushFilters = useCallback((filters: OracleFilters) => push(filters), [push]);
  const pushCleared = useCallback(() => {
    push(null);
  }, [push]);

  const pushJunk = useCallback((junkName: string) => {
    const url = buildJunkUrl(window.location.pathname, window.location.search, window.location.hash, junkName);
    window.history.pushState({ ...window.history.state, [JUNK_PUSH_MARKER]: true }, '', url);
  }, []);

  const closeJunk = useCallback(() => {
    const state = window.history.state as Record<string, unknown> | null;
    if (state?.[JUNK_PUSH_MARKER]) {
      window.history.back();
      return;
    }
    const url = buildJunkUrl(window.location.pathname, window.location.search, window.location.hash, null);
    window.history.replaceState(window.history.state, '', url);
  }, []);

  return {
    initialParams: initialParamsRef.current,
    pushFilters,
    pushCleared,
    pushJunk,
    closeJunk,
  };
}
