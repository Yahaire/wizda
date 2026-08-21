'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ORACLE_NAME } from '@/app/app.constants';
import { useDetail } from '@/components/detail/DetailProvider';
import { PageTitle } from '@/components/PageTitle';
import { PreparingVeil } from '@/components/PreparingVeil';
import { useOracleUrlState } from '@/hooks/useOracleUrlState';
import { useStrings, useWizda } from '@/i18n/LanguageProvider';
import { WizdaGlyph, WizdaMark, wizdaSay } from '@/mascot/wizda';
import { api, ApiError, MaintenanceError } from '@/services/api';
import {
    Button, Center, Grid, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DEFAULT_GUARANTEE_LIMIT } from '@shared/api/endpoints/junkToGuarantee.models';
import { IconSparkles } from '@tabler/icons-react';

import { BlessingsFilter } from './BlessingsFilter';
import { CategoryFilter } from './CategoryFilter';
import { CertaintySlider } from './CertaintySlider';
import { EquipmentSelect } from './EquipmentSelect';
import { FilterField } from './FilterField';
import { GradeFilter, GradeReadout } from './GradeFilter';
import { JunkDetailModal } from './JunkDetailModal';
import { computeFacets, OracleConflict } from './oracle.facets';
import {
    activeFilters, DEFAULT_FILTERS, FILTERS_STORAGE_KEY, filtersFromGuarantee, hasAnyFilter,
    KNOWN_CATEGORY_CODES, KNOWN_RANK_KINDS, MIN_LEVEL, OracleFilters, readStoredCertaintyPct
} from './oracle.logic';
import { filtersEqual, filtersFromParams, junkFromParams } from './oracleUrlState';
import { PopularQueries } from './PopularQueries';
import { QualityFilter, QualityReadout } from './QualityFilter';
import { RankFilter } from './RankFilter';
import { ResultsPanel } from './ResultsPanel';

import type { WizdaLines } from '@/mascot/voice';
import type {
  GuaranteeFilters,
  JunkGuaranteeEntry,
  JunkToGuaranteeQuery,
  JunkToGuaranteeResult,
} from '@shared/api/endpoints/junkToGuarantee.models';
function friendlyError(wizda: WizdaLines, errorCode: string): string {
  switch (errorCode) {
    case 'UNKNOWN_EQUIPMENT':
      return wizda.errors.unknownEquipment;
    case 'UNKNOWN_BLESSING':
      return wizda.errors.unknownBlessing;
    // The backend validates category/rank against the same shared tables this
    // client bundles, so these only fire when a saved filter outlives a change
    // to them. The prune below clears the culprit; this explains what happened.
    case 'UNKNOWN_CATEGORY':
    case 'UNKNOWN_RANK':
      return wizda.errors.unknownGearKind;
    case 'NO_QUERY':
      return wizda.oracle.snark;
    default:
      return wizda.errors.generic;
  }
}

function OracleContent() {
  const strings = useStrings();
  const wizda = useWizda();
  const [filters, setFilters] = useLocalStorage<OracleFilters>({
    key: FILTERS_STORAGE_KEY,
    defaultValue: DEFAULT_FILTERS,
    getInitialValueInEffect: true,
    // Backfill any axis a stored selection is missing — one saved before a filter
    // was added or renamed (e.g. the tier→rank rename) otherwise deserializes
    // without that key and crashes the panel on the first `.length` read. Merging
    // over the defaults also drops any stale renamed key harmlessly.
    deserialize: (value) => {
      if (value === undefined) {
        return DEFAULT_FILTERS;
      }
      try {
        return { ...DEFAULT_FILTERS, ...JSON.parse(value) };
      } catch {
        return DEFAULT_FILTERS;
      }
    },
  });

  // False until the page's own state has finished arriving. Neither source is
  // ready on the first render: `useLocalStorage` above hydrates a returning
  // player's picks in an effect (`getInitialValueInEffect`), and a shared link's
  // params are applied in another (see the mount effect below). Drives the
  // "still filling in" scrim — see `preparing` further down.
  const [seeded, setSeeded] = useState(false);

  // Junk + equipment reference lists are owned by the app-wide DetailProvider
  // (see layout.tsx) — it loads them once and they persist across navigation,
  // so the Oracle just reads them rather than fetching its own copy.
  // `junkByName` and `openJunk` back the detail modal below: the former
  // resolves `hasMultiplePools` for whatever is open (see `openEntryResolved`),
  // the latter is its "see full details" handoff.
  const {
    equipment: equipmentList,
    status: listStatus,
    junkByName,
    openJunk,
  } = useDetail();

  const [result, setResult] = useState<JunkToGuaranteeResult | null>(null);
  // The filters that produced `result` — snapshotted when the result is
  // presented, not the live `filters` state, so editing filters afterwards
  // (e.g. clearing them) can't change what "Show more" or the detail curve
  // fetch for an already-shown result set.
  const [queryFilters, setQueryFilters] = useState<OracleFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Whether the empty state is being *returned* to (via Back) rather than started
  // from. Not the same question as "are any filters set": DEFAULT_FILTERS already
  // asks for 3★ Blue and up, so a first-ever visitor has picks without having
  // picked anything — only stepping back off a result earns the "still here" line.
  const [steppedBack, setSteppedBack] = useState(false);
  // Bumped on every fresh calculate() (not on showMore's append) and used as
  // ResultsPanel's key, so a new calculation remounts the results list —
  // resetting its internal scroll position — instead of inheriting whatever
  // scroll offset the previous result set was left at.
  const [resultVersion, setResultVersion] = useState(0);

  // Set when the just-run query's shareable URL is too big to fit in a link
  // (see `MAX_SHAREABLE_URL_LENGTH`) — only a large equipment selection can do
  // this. Drives the Share button's dimmed, explain-instead-of-share state.
  const [shareDisabledReason, setShareDisabledReason] = useState<string | undefined>(undefined);

  // The row currently expanded in the detail modal, or null when it's closed.
  // Owned here rather than by `ResultsPanel`: which junk is open is part of
  // the URL (`&junk=`), so it has to live where the URL wiring does — see
  // `handleOpenJunk`/`handleCloseJunk`/`openJunkByName` below.
  const [openEntry, setOpenEntry] = useState<JunkGuaranteeEntry | null>(null);

  // A blocking prompt shown when a filter change makes an existing pick
  // impossible. Confirm → apply the conflict's own fix; cancel → revert to the
  // last conflict-free selection (undo the change that caused it). Some
  // contradictions have no in-range answer, and those offer only the undo.
  const [conflict, setConflict] = useState<OracleConflict | null>(null);
  const lastGoodRef = useRef<OracleFilters | null>(null);

  // Scroll the results into view after a fresh calculation (not on "show more").
  const resultsRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef(false);
  // Where Back sends you. See `clearResult` for why it's the filters and not the top.
  const filtersRef = useRef<HTMLDivElement>(null);

  // Side-by-side (Grid `md`+) only: cap the results panel to whatever vertical
  // space is left below it so a tall row list can't push the page past the
  // viewport and spawn a page-level scrollbar — the list scrolls internally
  // instead. Left untouched (undefined) on the stacked mobile layout, where the
  // page growing to fit the list is the existing, intentional behaviour.
  const [resultsMaxHeight, setResultsMaxHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const recompute = () => {
      const isSideBySide = window.matchMedia('(min-width: 62em)').matches;
      if (!resultsRef.current || !isSideBySide) {
        setResultsMaxHeight(undefined);
        return;
      }
      const top = resultsRef.current.getBoundingClientRect().top;
      setResultsMaxHeight(Math.max(200, window.innerHeight - top - 24));
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [result, loading]);

  const patch = useCallback((change: Partial<OracleFilters>) => {
    setFilters((current) => ({ ...current, ...change }));
  }, [setFilters]);

  // Tell the player if the shared equipment/junk load (DetailProvider) failed —
  // parity with the toast this page used to raise for its own fetch. Never
  // fires for a 503; that's handled by the global MaintenanceGate.
  useEffect(() => {
    if (listStatus === 'error') {
      wizdaSay(wizda.oracle.loadError, { glyph: WizdaGlyph.info, color: 'red' });
    }
    // Fire once when the load transitions to error; `wizda` is intentionally out
    // of the deps so a later language switch doesn't re-raise the same toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listStatus]);

  // The Oracle only guarantees junk-farmable gear, so it works off the pieces a
  // junk can actually drop (non-empty `sources`). `GET /equipment` now also
  // carries equipment no junk drops — that belongs in the lists, not here.
  const junkEquipment = useMemo(
    () => equipmentList?.filter((item) => item.sources.length > 0) ?? null,
    [equipmentList],
  );

  // Drop any remembered equipment names that aren't junk-farmable (stale storage,
  // or a name a later scrape dropped).
  useEffect(() => {
    if (!junkEquipment) {
      return;
    }
    const known = new Set(junkEquipment.map((item) => item.name));
    setFilters((current) => {
      const pruned = current.equipment.filter((name) => known.has(name));
      return pruned.length === current.equipment.length
        ? current
        : { ...current, equipment: pruned };
    });
  }, [junkEquipment, setFilters]);

  // Same idea for category/rank, but checked against the bundled taxonomy rather
  // than the API, so it runs at mount without waiting for the catalog. A code the
  // filter menus can no longer offer — remembered from before a game update
  // reshuffled the taxonomy, or replayed from a popular query — would otherwise
  // sit in storage and 400 the backend on every single Calculate.
  useEffect(() => {
    setFilters((current) => {
      const category = current.category.filter((code) => KNOWN_CATEGORY_CODES.has(code));
      const rank = current.rank.filter((kind) => KNOWN_RANK_KINDS.has(kind));
      if (category.length === current.category.length && rank.length === current.rank.length) {
        return current;
      }
      return { ...current, category, rank };
    });
  }, [setFilters]);

  // Which options still lead anywhere, what the level sliders top out at, and
  // whether the selection contradicts itself. See `oracle.facets.ts`.
  const facets = useMemo(() => computeFacets(junkEquipment, filters), [junkEquipment, filters]);

  // Raise the blocking conflict prompt on an impossible selection. Nothing is
  // judged (nor banked as a good state) until the catalog is in hand: an
  // untroubled verdict there only means we hadn't yet loaded the gear to trouble
  // it. Then one prompt at a time — while it's up the filters are frozen behind
  // it, so re-deriving would only restate the conflict it's already showing.
  const catalogLoaded = Boolean(junkEquipment?.length);
  useEffect(() => {
    if (!catalogLoaded) {
      return;
    }
    if (!facets.conflict) {
      lastGoodRef.current = filters;
      if (conflict) {
        setConflict(null);
      }
      return;
    }
    if (!conflict) {
      setConflict(facets.conflict);
    }
  }, [catalogLoaded, filters, facets, conflict]);

  const tidyConflict = () => {
    if (conflict?.fix) {
      patch(conflict.fix);
    }
    setConflict(null);
  };

  /**
   * Take back whatever caused the conflict. Normally that's the last selection we
   * saw work, but a player who closed the tab while a prompt was up comes back to
   * a remembered selection that was already impossible — there's no good state
   * behind it to return to. Rather than bounce them off the same prompt forever,
   * apply its cleanup, or start them over when it hasn't got one.
   */
  const undoConflict = () => {
    setFilters(lastGoodRef.current
      ?? (conflict?.fix ? { ...filters, ...conflict.fix } : DEFAULT_FILTERS));
    setConflict(null);
  };

  // Scroll to the results once a fresh calculation lands.
  useEffect(() => {
    if (result && pendingScrollRef.current) {
      pendingScrollRef.current = false;
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  const buildQuery =(filtersForQuery: OracleFilters, offset: number): JunkToGuaranteeQuery => ({
    ...activeFilters(filtersForQuery),
    certainty: filtersForQuery.certaintyPct / 100,
    limit: DEFAULT_GUARANTEE_LIMIT,
    offset,
  });

  // Per-junk certainty curve for the results detail modal — same filters as the
  // guarantee query that produced the currently-shown result (not the live
  // filters, which may have since changed) so the pool matches.
  const requestCurve = useCallback(
    (junkName: string, certainties: number[]) => api.certaintyCurve({
      ...activeFilters(queryFilters ?? filters),
      junkName,
      certainties,
    }),
    [queryFilters, filters],
  );

  const handleApiError = (error: unknown) => {
    // A 503 here is handled by the global MaintenanceGate.
    if (error instanceof MaintenanceError) {
      return;
    }
    const code = error instanceof ApiError ? error.errorCode : 'INTERNAL_ERROR';
    wizdaSay(friendlyError(wizda, code), { glyph: WizdaGlyph.info, color: 'red' });
  };

  /**
   * Run the query. `target` defaults to the live selection, but a caller that has
   * just set new filters passes them explicitly — `setFilters` won't have landed in
   * this render's `filters` yet, so the closure would otherwise run the *previous*
   * selection (see `applyPopular`).
   *
   * `push: false` skips writing a history entry — for the two callers that are
   * *replaying* a URL the address bar already shows (landing on a shared link,
   * browser Back/Forward) rather than performing a fresh deliberate action.
   * Pushing there too would double up: the URL already names this state, and
   * every default (`push: true`) caller already earns its own entry, so
   * chaining another push on top would either duplicate it or, worse, corrupt
   * the position Back/Forward is trying to restore.
   *
   * Returns the fetched result (or `undefined` on an early return/error) so a
   * caller resolving a deep-linked junk (`openJunkByName`, via `applyUrlState`)
   * can check the *just-fetched* page for it directly — not by reading
   * `result`/`queryFilters` back out of React state, which wouldn't yet
   * reflect this call's update by the time an awaited continuation resumes.
   */
  const calculate = async (
    target: OracleFilters = filters,
    options: { push?: boolean } = {},
  ): Promise<JunkToGuaranteeResult | undefined> => {
    const { push = true } = options;
    if (!hasAnyFilter(target)) {
      wizdaSay(wizda.oracle.snark, { glyph: WizdaGlyph.snark });
      return undefined;
    }
    setLoading(true);
    setResult(null);
    // A fresh calculation invalidates whatever the modal was showing — it
    // described a row from the *previous* result, not this one.
    setOpenEntry(null);
    setSteppedBack(false);
    setResultVersion((version) => version + 1);
    pendingScrollRef.current = true;
    try {
      const fresh = await api.junkToGuarantee(buildQuery(target, 0));
      setQueryFilters(target);
      setResult(fresh);
      if (push) {
        const { fit } = pushFilters(target);
        setShareDisabledReason(fit ? undefined : wizda.share.tooLarge);
      } else {
        setShareDisabledReason(undefined);
      }
      return fresh;
    } catch (error) {
      pendingScrollRef.current = false;
      handleApiError(error);
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resolves `&junk=` against `resultForLookup` — either the just-fetched page
   * (a fresh calculate) or the already-displayed `result` (a same-query
   * open/close via Back/Forward, see `applyUrlState`) — and opens the modal.
   * `null`/not-found closes it, silently: an unresolvable deep link (a typo, a
   * junk a later scrape dropped) is no different from the 404 the API itself
   * would give it, and the plan for that is the same as `UNKNOWN_EQUIPMENT`
   * elsewhere — leave the ranking showing rather than block on it.
   *
   * `forFilters` is the *local* value the query was (or is being) run with —
   * never `queryFilters`/`filters` React state, which can lag behind what
   * just ran by a render or two (same reasoning as `calculate`'s return value,
   * above).
   *
   * Results only page 50 at a time (`DEFAULT_GUARANTEE_LIMIT`), so a shared
   * junk ranked past the first page won't be in `resultForLookup` — that's the
   * fallback below: a single-point `certaintyCurve` request at the current
   * certainty stands in for the row `junkToGuarantee` would have produced.
   * That request is also the existence check — it 404s `UNKNOWN_JUNK` on a
   * name no junk has, which is exactly the case worth closing on. Nothing here
   * consults the junk catalogue first: on a cold load of a shared link its
   * fetch is still in flight (`DetailProvider` starts it from an effect on the
   * same mount), so gating on it would turn every such link into a silent
   * no-op. The one field it owns, `hasMultiplePools`, is resolved at render
   * instead — see `openEntryResolved`.
   */
  const openJunkByName = async (
    junkName: string | null,
    resultForLookup: JunkToGuaranteeResult | null,
    forFilters: OracleFilters,
  ) => {
    if (!junkName) {
      setOpenEntry(null);
      return;
    }
    const fromResult = resultForLookup?.results.find((entry) => entry.junkName === junkName);
    if (fromResult) {
      setOpenEntry(fromResult);
      return;
    }
    try {
      const curve = await api.certaintyCurve({
        ...activeFilters(forFilters),
        junkName,
        certainties: [forFilters.certaintyPct / 100],
      });
      const point = curve.points[0];
      if (!point || point.junkNeeded === null) {
        setOpenEntry(null);
        return;
      }
      setOpenEntry({
        junkName: curve.junkName,
        junkDisplayName: curve.junkDisplayName,
        junkNameReading: curve.junkNameReading,
        // Not on the curve response; `openEntryResolved` fills it in from the
        // junk catalogue, whenever that lands.
        hasMultiplePools: false,
        probabilityPerJunk: curve.probabilityPerJunk,
        junkNeeded: point.junkNeeded,
      });
    } catch {
      // Same silent-fallback shape as a not-found lookup above — includes a
      // 404 UNKNOWN_JUNK from a stale/hand-typed name.
      setOpenEntry(null);
    }
  };

  /**
   * Applies a URL's Oracle params to the page — the single code path for
   * "landed on a shared link" (mount) and "navigated here via Back/Forward"
   * (`popstate`), so the two can't drift into separate behaviour. Neither
   * caller pushes: the URL they're reacting to already represents this state.
   *
   * Certainty is the one axis a shared link never carries (see
   * `oracleUrlState.ts`), so the caller supplies the fallback: landing on
   * someone else's link must keep *this* player's own certainty rather than
   * resetting to the default. It's a parameter and not a read of
   * `filters.certaintyPct` here because the two callers reach this at
   * different points in the hydration cycle — see each of them below.
   *
   * When the popped URL's filter portion is unchanged from what's already on
   * screen (`filtersEqual` against `queryFilters`), only `&junk=` toggled —
   * opening or closing the modal via Back/Forward — so this skips straight to
   * `openJunkByName` against the *existing* `result` rather than refetching
   * the same query a second time.
   *
   * Returns the parsed filters (or `null`) so the caller can react — `null`
   * only means "no filter axis is present" (`junk` alone doesn't count, same
   * as `hasAnyFilter`), which the mount effect and the popstate handler treat
   * differently (see below). A `junk=` with no filters alongside it — never
   * produced by `pushJunk`, which only ever adds it on top of an existing
   * query — is therefore silently ignored rather than opened against nothing.
   */
  const applyUrlState = (params: URLSearchParams, fallbackCertaintyPct: number) => {
    const parsed = filtersFromParams(params, fallbackCertaintyPct);
    const junkName = junkFromParams(params);
    if (parsed) {
      setFilters(parsed);
      if (queryFilters && filtersEqual(parsed, queryFilters)) {
        void openJunkByName(junkName, result, parsed);
      } else {
        void calculate(parsed, { push: false }).then((fresh) => openJunkByName(junkName, fresh ?? null, parsed));
      }
    }
    return parsed;
  };

  const {
    initialParams, pushFilters, pushCleared, pushJunk, closeJunk,
  } = useOracleUrlState((params) => {
    // Browser Back/Forward: unlike the mount effect below, a params-less URL
    // here is a real destination (the empty state, reached via the UI "Back"
    // button — see `handleBackToStart`) rather than an ordinary fresh visit,
    // so it gets `clearResult`'s state reset and scroll cue.
    //
    // `filters.certaintyPct` is the right fallback here: this callback is kept
    // fresh on every render (see `useOracleUrlState`), so by the time a Back
    // can happen the stored selection has long since hydrated into it.
    if (!applyUrlState(params, filters.certaintyPct)) {
      clearResult();
    }
  });

  // Seed the page from the URL it loaded with, once. A fresh visit with no
  // Oracle params is a no-op here (contrast the popstate handler above) — there's
  // nothing to clear on a page that hasn't shown a result yet.
  //
  // Runs once on mount by design: `filters`/`calculate` are captured as they
  // stood on the very first render — which is exactly why the fallback
  // certainty is read from `localStorage` rather than from `filters`.
  // `useLocalStorage`'s hydration effect (`getInitialValueInEffect: true`, see
  // above) hasn't landed in *this* closure's `filters` and never will, so
  // trusting it here would replay every shared link at the default certainty
  // and then write that default back over the player's remembered one. See
  // `readStoredCertaintyPct`.
  useEffect(() => {
    applyUrlState(initialParams, readStoredCertaintyPct());
    // Both sources are settled by the end of this line, so this is where the
    // scrim comes down: `useLocalStorage`'s own hydration effect is registered
    // by its hook call above, which means React has already run it by the time
    // this one fires, and every write from the pair lands in this same flush —
    // the next render has the final filters and no scrim, together.
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Replay one of the most-searched queries: adopt its filters wholesale and run it
   * on the spot. The player asked a question by picking it, so making them find and
   * press Calculate as well would only be ceremony.
   *
   * Their certainty carries over untouched — it's how sure *they* want to be, not
   * part of the hunt someone else was on.
   */
  const applyPopular = (picked: GuaranteeFilters) => {
    const next = filtersFromGuarantee(picked, filters.certaintyPct);
    setFilters(next);
    calculate(next);
  };

  /**
   * Step back from a result to the empty state, leaving the filters as they are, and
   * ride back up to them.
   *
   * The scroll isn't a flourish — it's the fix for a lurch. Stacked (mobile), the tall
   * results panel is what you're scrolled down to, and dropping it shrinks the document
   * out from under you; the browser then clamps your scroll position, and *that* is the
   * jerk. Moving deliberately to the filters pre-empts it, and they're the one thing
   * that can't move while it happens: they sit above the results, so the collapse never
   * touches their offset. Side-by-side there's nothing to scroll and this is a no-op —
   * the panel is already capped to the viewport (see `resultsMaxHeight`).
   *
   * It lands where it should, too: the way back from an answer is the question.
   */
  const clearResult = () => {
    setResult(null);
    setQueryFilters(null);
    setOpenEntry(null);
    setSteppedBack(true);
    filtersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * The UI "Back" button's handler: clears the result *and* pushes a fresh,
   * params-less history entry, so a later browser Back lands one step further
   * back — the previous query — rather than replaying this same empty state.
   * `clearResult` alone is also used by the popstate handler above, which must
   * NOT push (the URL it's reacting to already is that entry).
   */
  const handleBackToStart = () => {
    clearResult();
    pushCleared();
  };

  /** A result row was clicked: open its detail and push `&junk=` for it. */
  const handleOpenJunk = (entry: JunkGuaranteeEntry) => {
    setOpenEntry(entry);
    pushJunk(entry.junkName);
  };

  /**
   * The modal's close (× or backdrop): clear it here *and* let `closeJunk`
   * settle the URL — `history.back()` when this page pushed the entry being
   * left, `replaceState` otherwise (a visitor who landed directly on a
   * `junk=` link). See `useOracleUrlState`.
   */
  const handleCloseJunk = () => {
    setOpenEntry(null);
    closeJunk();
  };

  /**
   * What the detail modal actually shows: `openEntry` with `hasMultiplePools`
   * re-read from the junk catalogue whenever that's loaded.
   *
   * It's resolved here, at render, rather than baked in when the modal opens,
   * because the two are not reliably ordered: `openJunkByName`'s paging-gap
   * fallback can run before `DetailProvider`'s lists have arrived (a cold load
   * of a shared `&junk=` link races them). Reading it on every render means the
   * caveat appears as soon as the lists land, in either order, instead of the
   * open being gated on a fetch it doesn't otherwise need.
   *
   * A row that came from the results page is unaffected: `junkToGuarantee`
   * already sent the same flag, off the same column.
   */
  const openEntryResolved = useMemo(() => {
    if (!openEntry) {
      return null;
    }
    const known = junkByName.get(openEntry.junkName);
    if (!known) {
      return openEntry;
    }
    return { ...openEntry, hasMultiplePools: known.hasMultiplePools };
  }, [openEntry, junkByName]);

  const showMore = async () => {
    if (!result || !queryFilters) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await api.junkToGuarantee(buildQuery(queryFilters, result.results.length));
      setResult((current) => (current
        ? { ...next, results: [...current.results, ...next.results] }
        : next));
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const canCalculate = hasAnyFilter(filters);

  /*
   * Whether to keep the "still filling in" scrim up (see `PreparingVeil`). Two
   * waits under one cover, because to the player they're the same moment: the
   * state above arriving, and — only if it turned out to name equipment — the
   * gear catalogue that turns those stored English keys into the localized
   * names they actually picked. Nothing else waits on the catalogue; every
   * other control is complete without it, and the equipment select disables
   * itself meanwhile.
   *
   * Latched rather than plainly derived: a language switch re-pulls the lists
   * (see `DetailProvider`) with the old ones still on screen and the form long
   * since filled in, so re-deriving would drop a scrim over a page that isn't
   * waiting for anything the player can see.
   */
  const preparedRef = useRef(false);
  if (
    !preparedRef.current
    && seeded
    && (filters.equipment.length === 0 || listStatus === 'ready' || listStatus === 'error')
  ) {
    preparedRef.current = true;
  }

  const filterPanel = (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="lg">
        <FilterField
          label={strings.oracle.equipmentLabel}
          description={wizda.oracle.filterHelp.equipment}
          onClear={() => patch({ equipment: [] })}
          canClear={filters.equipment.length > 0}
        >
          <EquipmentSelect
            data={junkEquipment ?? []}
            value={filters.equipment}
            onChange={(value) => patch({ equipment: value })}
            available={facets.equipment}
            disabled={!junkEquipment}
          />
        </FilterField>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <FilterField
            label={strings.oracle.categoryLabel}
            description={wizda.oracle.filterHelp.category}
            onClear={() => patch({ category: [] })}
            canClear={filters.category.length > 0}
          >
            <CategoryFilter
              value={filters.category}
              onChange={(value) => patch({ category: value })}
              offered={facets.catalogCategory}
              available={facets.category}
            />
          </FilterField>

          <FilterField
            label={strings.oracle.rankLabel}
            description={wizda.oracle.filterHelp.rank}
            onClear={() => patch({ rank: [] })}
            canClear={filters.rank.length > 0}
          >
            <RankFilter
              value={filters.rank}
              onChange={(value) => patch({ rank: value })}
              available={facets.rank}
            />
          </FilterField>
        </SimpleGrid>

        <FilterField
          label={strings.oracle.qualityLabel}
          description={wizda.oracle.filterHelp.quality}
          readout={<QualityReadout value={filters.minQuality} max={facets.maxQuality} />}
          onClear={() => patch({ minQuality: MIN_LEVEL })}
          canClear={filters.minQuality > MIN_LEVEL}
        >
          <QualityFilter
            value={filters.minQuality}
            onChange={(value) => patch({ minQuality: value })}
            max={facets.maxQuality}
          />
        </FilterField>

        <FilterField
          label={strings.oracle.gradeLabel}
          description={wizda.oracle.filterHelp.grade}
          readout={(
            <GradeReadout
              value={filters.minGrade}
              max={facets.maxGrade}
              blessingCount={filters.blessings.length}
            />
          )}
          onClear={() => patch({ minGrade: MIN_LEVEL })}
          canClear={filters.minGrade > MIN_LEVEL}
        >
          <GradeFilter
            value={filters.minGrade}
            onChange={(value) => patch({ minGrade: value })}
            max={facets.maxGrade}
            blessingCount={filters.blessings.length}
          />
        </FilterField>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <FilterField
            label={strings.oracle.blessingsLabel}
            description={wizda.oracle.filterHelp.blessings}
            onClear={() => patch({ blessings: [] })}
            canClear={filters.blessings.length > 0}
          >
            <BlessingsFilter
              value={filters.blessings}
              onChange={(value) => patch({ blessings: value })}
              available={facets.blessings}
            />
          </FilterField>

          <FilterField
            label={strings.oracle.certaintyLabel}
            description={wizda.oracle.filterHelp.certainty}
          >
            <CertaintySlider
              value={filters.certaintyPct}
              onChange={(value) => patch({ certaintyPct: value })}
            />
          </FilterField>
        </SimpleGrid>

        <Button
          size="md"
          fullWidth
          color="crimson"
          loading={loading}
          leftSection={<IconSparkles size={18} />}
          onClick={() => (canCalculate ? calculate() : wizdaSay(wizda.oracle.snark, { glyph: WizdaGlyph.snark }))}
          style={canCalculate ? undefined : {
            opacity: 0.55,
            filter: 'grayscale(0.6)',
            cursor: 'not-allowed',
          }}
        >
          {strings.oracle.calculateButton}
        </Button>
      </Stack>
    </Paper>
  );

  return (
    <Stack gap="lg">
      <div>
        {/* The address bar carries the just-run query (see `useOracleUrlState`),
            so this shares that result — or, before a first Calculate, the tool
            itself, same as before. Certainty never rides along: see
            `oracleUrlState.ts`. */}
        <PageTitle
          shareable
          shareDisabledReason={shareDisabledReason}
        >
          {ORACLE_NAME}
        </PageTitle>
        <Text className="wizda-speech wizda-speech-muted" c="dimmed">
          {wizda.oracle.tagline}
        </Text>
      </div>

      <PreparingVeil preparing={!preparedRef.current}>
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <div ref={filtersRef} className="wizda-scroll-clear-header">
              {filterPanel}
            </div>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <div ref={resultsRef} className="wizda-scroll-clear-header">
              {result || loading ? (
                <Paper
                  withBorder
                  p="lg"
                  radius="md"
                  style={resultsMaxHeight ? {
                    maxHeight: resultsMaxHeight,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  } : undefined}
                >
                  <ResultsPanel
                    key={resultVersion}
                    result={result}
                    loading={loading}
                    loadingMore={loadingMore}
                    onShowMore={showMore}
                    onOpenJunk={handleOpenJunk}
                    fillHeight={Boolean(resultsMaxHeight)}
                    onBack={handleBackToStart}
                  />
                </Paper>
              ) : (
                <Paper withBorder p="lg" radius="md" h="100%">
                  <Stack align="center" justify="center" h="100%" gap="xs" mih={200}>
                    <IconSparkles size={32} color="var(--mantine-color-crimson-5)" />
                    <Text className="wizda-speech" ta="center">
                      {steppedBack ? wizda.oracle.emptyPromptWithPicks : wizda.oracle.emptyPrompt}
                    </Text>
                    <PopularQueries onPick={applyPopular} />
                  </Stack>
                </Paper>
              )}
            </div>
          </Grid.Col>
        </Grid>
      </PreparingVeil>

      <Modal
        opened={Boolean(conflict)}
        onClose={undoConflict}
        title={strings.oracle.conflictModalTitle}
        centered
        size="md"
      >
        <Stack gap="md">
          <Text className="wizda-speech">
            <WizdaMark glyph={WizdaGlyph.confirm} />{conflict?.message}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant={conflict?.fix ? 'subtle' : 'filled'}
              color={conflict?.fix ? 'gray' : 'crimson'}
              onClick={undoConflict}
            >
              {strings.oracle.undoButton}
            </Button>
            {conflict?.fix && (
              <Button color="crimson" onClick={tidyConflict}>
                {strings.oracle.cleanUpButton}
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>

      {/* Per-junk detail — recovers the full name when it's been truncated,
          and deep-links via `&junk=` (see `handleOpenJunk`/`handleCloseJunk`). */}
      <JunkDetailModal
        entry={openEntryResolved}
        onClose={handleCloseJunk}
        queryFilters={queryFilters ?? filters}
        onRequestCurve={requestCurve}
        onSeeFullDetails={(junkName) => openJunk(junkName, true)}
      />
    </Stack>
  );
}

/**
 * `useOracleUrlState` reads `useSearchParams()`, which needs a `<Suspense>`
 * boundary above it in a statically prerendered route (or `next build` fails
 * with the CSR-bailout error) — this wrapper is that boundary. Same pattern as
 * `JunkListView`/`EquipmentListView`.
 */
export function OraclePage() {
  return (
    <Suspense fallback={<Center mih={200}><Loader color="crimson" /></Center>}>
      <OracleContent />
    </Suspense>
  );
}
