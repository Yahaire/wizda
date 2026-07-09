'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ORACLE_NAME, ORACLE_TAGLINE } from '@/app/app.constants';
import { GRADE_HEX, QualityStars } from '@/components/gear/gearDisplays';
import { WizdaEmoji, wizdaSay } from '@/mascot/wizda';
import { api, ApiError, MaintenanceError } from '@/services/api';
import {
    Alert, Button, ColorSwatch, Grid, Group, Modal, Paper, SimpleGrid, Stack, Text, Title, Tooltip
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DEFAULT_GUARANTEE_LIMIT } from '@shared/api/endpoints/junkToGuarantee.models';
import { GRADES } from '@shared/domain/grade';
import { QUALITIES } from '@shared/domain/quality';
import { IconInfoCircle, IconSparkles } from '@tabler/icons-react';

import { BlessingsFilter } from './BlessingsFilter';
import { CategoryFilter } from './CategoryFilter';
import { CertaintySlider } from './CertaintySlider';
import { EquipmentSelect } from './EquipmentSelect';
import { FilterField } from './FilterField';
import { LevelToggleGroup } from './LevelToggleGroup';
import { TierFilter } from './TierFilter';
import {
    activeFilters, allowedGrades, allowedQualities, EMPTY_FILTERS, FILTER_DESCRIPTIONS,
    FILTERS_STORAGE_KEY, gradeName, hasAnyFilter, joinHuman, OracleFilters, qualityLabel
} from './oracle.logic';
import { ResultsPanel } from './ResultsPanel';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
import type {
  JunkToGuaranteeQuery,
  JunkToGuaranteeResult,
} from '@shared/api/endpoints/junkToGuarantee.models';
const SNARK = "I'm not showing all that! Pick a filter or two and save me some work?";

function friendlyError(errorCode: string): string {
  switch (errorCode) {
    case 'UNKNOWN_EQUIPMENT':
      return "Some of that gear isn't in my notes anymore — try reselecting it.";
    case 'UNKNOWN_BLESSING':
      return "One of those blessings isn't in my notes anymore — try reselecting it.";
    case 'NO_QUERY':
      return SNARK;
    default:
      return "Something went sideways on my end — give it another go in a moment.";
  }
}

export function OraclePage() {
  const [filters, setFilters] = useLocalStorage<OracleFilters>({
    key: FILTERS_STORAGE_KEY,
    defaultValue: EMPTY_FILTERS,
    getInitialValueInEffect: true,
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
  // impossible. Confirm → clear the offending picks; cancel → revert to the
  // last conflict-free selection (undo the change that caused it).
  const [conflict, setConflict] = useState<{ message: string } | null>(null);
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
          wizdaSay("I couldn't load the gear list — refresh and I'll try again.", {
            emoji: WizdaEmoji.info,
            color: 'red',
          });
        }
      });
  }, []);

  // Drop any remembered equipment names that no longer exist (stale storage).
  useEffect(() => {
    if (!equipmentList) {
      return;
    }
    const known = new Set(equipmentList.map((item) => item.name));
    setFilters((current) => {
      const pruned = current.equipment.filter((name) => known.has(name));
      return pruned.length === current.equipment.length
        ? current
        : { ...current, equipment: pruned };
    });
  }, [equipmentList, setFilters]);

  const equipmentByName = useMemo(() => {
    const map = new Map<string, EquipmentListItem>();
    for (const item of equipmentList ?? []) {
      map.set(item.name, item);
    }
    return map;
  }, [equipmentList]);

  const selectedItems = useMemo(
    () => filters.equipment
      .map((name) => equipmentByName.get(name))
      .filter((item): item is EquipmentListItem => Boolean(item)),
    [filters.equipment, equipmentByName],
  );

  const allowedGrade = useMemo(
    () => allowedGrades(selectedItems, filters.blessings.length),
    [selectedItems, filters.blessings.length],
  );
  const allowedQuality = useMemo(
    () => allowedQualities(selectedItems),
    [selectedItems],
  );

  const equipMaxGrade = selectedItems.length
    ? Math.max(1, ...selectedItems.map((item) => item.maxDropGrade ?? 5))
    : 5;
  const blessingMinGrade = Math.min(filters.blessings.length + 1, 5);

  // Detect an impossible selection and raise the blocking conflict prompt.
  useEffect(() => {
    const badGrades = filters.grade
      .filter((grade) => !allowedGrade.has(grade))
      .sort((a, b) => a - b);
    const badQualities = filters.quality
      .filter((quality) => !allowedQuality.has(quality))
      .sort((a, b) => a - b);

    if (badGrades.length === 0 && badQualities.length === 0) {
      lastGoodRef.current = filters;
      if (conflict) {
        setConflict(null);
      }
      return;
    }
    if (conflict) {
      return;
    }

    let message: string;
    if (badGrades.length && !badQualities.length) {
      const names = joinHuman(badGrades.map((grade) => gradeName(grade).toLowerCase()));
      const tooHigh = badGrades.every((grade) => grade > equipMaxGrade);
      const tooLow = badGrades.every((grade) => grade < blessingMinGrade);
      if (tooHigh) {
        message = `I don't think that gear drops as ${names}.`;
      } else if (tooLow) {
        message = `For ${filters.blessings.length} blessings you'll need a higher grade — ${names} can't hold them all.`;
      } else {
        message = `${names} don't fit the rest of your picks.`;
      }
    } else if (badQualities.length && !badGrades.length) {
      const labels = joinHuman(badQualities.map(qualityLabel));
      message = `That gear doesn't seem to reach ${labels}.`;
    } else {
      message = "Some of your picks don't fit together anymore.";
    }

    setConflict({ message });
  }, [
    filters,
    allowedGrade,
    allowedQuality,
    equipMaxGrade,
    blessingMinGrade,
    conflict,
  ]);

  const tidyConflict = () => {
    patch({
      grade: filters.grade.filter((grade) => allowedGrade.has(grade)),
      quality: filters.quality.filter((quality) => allowedQuality.has(quality)),
    });
    setConflict(null);
  };

  const undoConflict = () => {
    if (lastGoodRef.current) {
      setFilters(lastGoodRef.current);
    }
    setConflict(null);
  };

  // Scroll to the results once a fresh calculation lands.
  useEffect(() => {
    if (result && pendingScrollRef.current) {
      pendingScrollRef.current = false;
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  const gradeOptions = GRADES.map((grade) => ({
    value: grade.value,
    disabled: !allowedGrade.has(grade.value),
    // Circle only — the colour already conveys the grade, and the name is just
    // filler that overflows the narrow chips. Kept as a tooltip / aria-label so
    // the name stays discoverable on hover and to screen readers.
    label: (
      <Tooltip label={grade.name} withArrow openDelay={300}>
        <ColorSwatch
          color={GRADE_HEX[grade.value]}
          size={16}
          withShadow={false}
          aria-label={grade.name}
        />
      </Tooltip>
    ),
  }));

  const qualityOptions = QUALITIES.map((quality) => ({
    value: quality.value,
    disabled: !allowedQuality.has(quality.value),
    label: <QualityStars value={quality.value} />,
  }));

  const buildQuery = (filtersForQuery: OracleFilters, offset: number): JunkToGuaranteeQuery => ({
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
      wizdaSay(SNARK, { emoji: WizdaEmoji.snark });
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
          description={FILTER_DESCRIPTIONS.equipment}
          onClear={() => patch({ equipment: [] })}
          canClear={filters.equipment.length > 0}
        >
          <EquipmentSelect
            data={equipmentList ?? []}
            value={filters.equipment}
            onChange={(value) => patch({ equipment: value })}
            disabled={!equipmentList}
          />
        </FilterField>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <FilterField
            label="Category"
            description={FILTER_DESCRIPTIONS.category}
            onClear={() => patch({ category: [] })}
            canClear={filters.category.length > 0}
          >
            <CategoryFilter
              value={filters.category}
              onChange={(value) => patch({ category: value })}
            />
          </FilterField>

          <FilterField
            label="Tier"
            description={FILTER_DESCRIPTIONS.tier}
            onClear={() => patch({ tier: [] })}
            canClear={filters.tier.length > 0}
          >
            <TierFilter
              value={filters.tier}
              onChange={(value) => patch({ tier: value })}
            />
          </FilterField>
        </SimpleGrid>

        <FilterField
          label="Quality"
          description={FILTER_DESCRIPTIONS.quality}
          onClear={() => patch({ quality: [] })}
          canClear={filters.quality.length > 0}
        >
          <LevelToggleGroup
            options={qualityOptions}
            value={filters.quality}
            onChange={(value) => patch({ quality: value })}
          />
        </FilterField>

        <FilterField
          label="Grade"
          description={FILTER_DESCRIPTIONS.grade}
          onClear={() => patch({ grade: [] })}
          canClear={filters.grade.length > 0}
        >
          <LevelToggleGroup
            options={gradeOptions}
            value={filters.grade}
            onChange={(value) => patch({ grade: value })}
          />
        </FilterField>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <FilterField
            label="Blessings"
            description={FILTER_DESCRIPTIONS.blessings}
            onClear={() => patch({ blessings: [] })}
            canClear={filters.blessings.length > 0}
          >
            <BlessingsFilter
              value={filters.blessings}
              onChange={(value) => patch({ blessings: value })}
            />
          </FilterField>

          <FilterField
            label="Certainty"
            description={FILTER_DESCRIPTIONS.certainty}
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
          onClick={() => (canCalculate ? calculate() : wizdaSay(SNARK, { emoji: WizdaEmoji.snark }))}
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
        <Text className="wizda-speech">{ORACLE_TAGLINE}</Text>
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
                    Pick what you&apos;re after, then hit Calculate and I&apos;ll count the junk for you.
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
            <Button variant="subtle" color="gray" onClick={undoConflict}>
              Undo that choice
            </Button>
            <Button color="crimson" onClick={tidyConflict}>
              Clean up
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
