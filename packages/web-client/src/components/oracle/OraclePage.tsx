'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ORACLE_NAME } from '@/app/app.constants';
import { wizda } from '@/mascot/voice';
import { WizdaEmoji, wizdaSay } from '@/mascot/wizda';
import { api, ApiError, MaintenanceError } from '@/services/api';
import {
    Alert, Button, Grid, Group, Modal, Paper, SimpleGrid, Stack, Text, Title
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DEFAULT_GUARANTEE_LIMIT } from '@shared/api/endpoints/junkToGuarantee.models';
import { IconInfoCircle, IconSparkles } from '@tabler/icons-react';

import { BlessingsFilter } from './BlessingsFilter';
import { CategoryFilter } from './CategoryFilter';
import { CertaintySlider } from './CertaintySlider';
import { EquipmentSelect } from './EquipmentSelect';
import { FilterField } from './FilterField';
import { GradeFilter, GradeReadout } from './GradeFilter';
import { computeFacets, OracleConflict } from './oracle.facets';
import {
    activeFilters, DEFAULT_FILTERS, FILTERS_STORAGE_KEY, hasAnyFilter, MIN_LEVEL, OracleFilters
} from './oracle.logic';
import { QualityFilter, QualityReadout } from './QualityFilter';
import { RankFilter } from './RankFilter';
import { ResultsPanel } from './ResultsPanel';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
import type {
  JunkToGuaranteeQuery,
  JunkToGuaranteeResult,
} from '@shared/api/endpoints/junkToGuarantee.models';
function friendlyError(errorCode: string): string {
  switch (errorCode) {
    case 'UNKNOWN_EQUIPMENT':
      return wizda.errors.unknownEquipment;
    case 'UNKNOWN_BLESSING':
      return wizda.errors.unknownBlessing;
    case 'NO_QUERY':
      return wizda.oracle.snark;
    default:
      return wizda.errors.generic;
  }
}

export function OraclePage() {
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

  const [equipmentList, setEquipmentList] = useState<EquipmentListItem[] | null>(null);
  const [maintenance, setMaintenance] = useState<string | null>(null);

  const [result, setResult] = useState<JunkToGuaranteeResult | null>(null);
  // The filters that produced `result` — snapshotted when the result is
  // presented, not the live `filters` state, so editing filters afterwards
  // (e.g. clearing them) can't change what "Show more" or the detail curve
  // fetch for an already-shown result set.
  const [queryFilters, setQueryFilters] = useState<OracleFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Bumped on every fresh calculate() (not on showMore's append) and used as
  // ResultsPanel's key, so a new calculation remounts the results list —
  // resetting its internal scroll position — instead of inheriting whatever
  // scroll offset the previous result set was left at.
  const [resultVersion, setResultVersion] = useState(0);

  // A blocking prompt shown when a filter change makes an existing pick
  // impossible. Confirm → apply the conflict's own fix; cancel → revert to the
  // last conflict-free selection (undo the change that caused it). Some
  // contradictions have no in-range answer, and those offer only the undo.
  const [conflict, setConflict] = useState<OracleConflict | null>(null);
  const lastGoodRef = useRef<OracleFilters | null>(null);

  // Scroll the results into view after a fresh calculation (not on "show more").
  const resultsRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef(false);

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

  // Load the equipment names that feed the filter select.
  useEffect(() => {
    api.listEquipment()
      .then(setEquipmentList)
      .catch((error) => {
        if (error instanceof MaintenanceError) {
          setMaintenance(error.message);
        } else {
          wizdaSay(wizda.oracle.loadError, {
            emoji: WizdaEmoji.info,
            color: 'red',
          });
        }
      });
  }, []);

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
    if (error instanceof MaintenanceError) {
      setMaintenance(error.message);
      return;
    }
    const code = error instanceof ApiError ? error.errorCode : 'INTERNAL_ERROR';
    wizdaSay(friendlyError(code), { emoji: WizdaEmoji.info, color: 'red' });
  };

  const calculate = async () => {
    if (!hasAnyFilter(filters)) {
      wizdaSay(wizda.oracle.snark, { emoji: WizdaEmoji.snark });
      return;
    }
    setLoading(true);
    setResult(null);
    setResultVersion((version) => version + 1);
    pendingScrollRef.current = true;
    try {
      const fresh = await api.junkToGuarantee(buildQuery(filters, 0));
      setQueryFilters(filters);
      setResult(fresh);
    } catch (error) {
      pendingScrollRef.current = false;
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

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

  const filterPanel = (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="lg">
        <FilterField
          label="Equipment"
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
            label="Category"
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
            label="Rank"
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
          label="Quality"
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
          label="Grade"
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
            label="Blessings"
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
            label="Certainty"
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
          onClick={() => (canCalculate ? calculate() : wizdaSay(wizda.oracle.snark, { emoji: WizdaEmoji.snark }))}
          style={canCalculate ? undefined : {
            opacity: 0.55,
            filter: 'grayscale(0.6)',
            cursor: 'not-allowed',
          }}
        >
          Calculate
        </Button>
      </Stack>
    </Paper>
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{ORACLE_NAME}</Title>
        <Text className="wizda-speech wizda-speech-muted" c="dimmed">
          {wizda.oracle.tagline}
        </Text>
      </div>

      {maintenance && (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle />} title="Updating data">
          {maintenance}
        </Alert>
      )}

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          {filterPanel}
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <div ref={resultsRef} style={{ scrollMarginTop: 12 }}>
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
                  queryFilters={queryFilters ?? filters}
                  onRequestCurve={requestCurve}
                  fillHeight={Boolean(resultsMaxHeight)}
                />
              </Paper>
            ) : (
              <Paper withBorder p="xl" radius="md" h="100%">
                <Stack align="center" justify="center" h="100%" gap="xs" mih={200}>
                  <IconSparkles size={32} color="var(--mantine-color-crimson-5)" />
                  <Text className="wizda-speech" ta="center">
                    {wizda.oracle.emptyPrompt}
                  </Text>
                </Stack>
              </Paper>
            )}
          </div>
        </Grid.Col>
      </Grid>

      <Modal
        opened={Boolean(conflict)}
        onClose={undoConflict}
        title="Hold on a moment"
        centered
        size="md"
      >
        <Stack gap="md">
          <Text className="wizda-speech">
            {WizdaEmoji.confirm} {conflict?.message}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant={conflict?.fix ? 'subtle' : 'filled'}
              color={conflict?.fix ? 'gray' : 'crimson'}
              onClick={undoConflict}
            >
              Undo
            </Button>
            {conflict?.fix && (
              <Button color="crimson" onClick={tidyConflict}>
                Clean up
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
