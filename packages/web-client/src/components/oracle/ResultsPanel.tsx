'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { CALCULATION_DOC_URL } from '@/app/app.constants';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useStrings, useWizda } from '@/i18n/LanguageProvider';
import { WizdaGlyph, WizdaMark } from '@/mascot/wizda';
import { createSearchMatcher, normalize } from '@/utils/search';
import {
    ActionIcon, Alert, Anchor, Box, Button, Center, Group, Loader, Modal, Paper, Stack, Text,
    TextInput, ThemeIcon, Tooltip, UnstyledButton
} from '@mantine/core';
import {
    IconAlertTriangle, IconArrowLeft, IconChevronRight, IconInfoCircle, IconSearch
} from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { formatPercent } from './oracle.logic';

import type {
  JunkGuaranteeEntry,
  JunkToGuaranteeResult,
} from '@shared/api/endpoints/junkToGuarantee.models';

const ROW_HEIGHT = 64;
const LIST_HEIGHT = 460;
const NUM_COL = 76;
const CHEVRON_COL = 16;

// Tap affordance on each result row (there's no hover on touch). The header
// reserves an equal-width empty slot so the number columns stay aligned with it.
const ROW_CHEVRON = <IconChevronRight size={CHEVRON_COL} style={{ opacity: 0.4, flexShrink: 0 }} />;

interface ResultsPanelProps {
  result: JunkToGuaranteeResult | null,
  loading: boolean,
  loadingMore: boolean,
  onShowMore: () => void,
  /**
   * Opens the detail modal for a row — owned by `OraclePage`, not this
   * component: which junk (if any) is open is part of the URL (`&junk=`), so
   * it has to live where the URL wiring does. See `docs/sharing.md`.
   */
  onOpenJunk: (entry: JunkGuaranteeEntry) => void,
  /**
   * When set, the row list stretches to fill its parent instead of using a
   * fixed height — the parent is expected to cap its own height in that case
   * (see the `resultsMaxHeight` measurement in {@link OraclePage}).
   */
  fillHeight?: boolean,
  /** Step back to the empty state. Rides along the header rather than claiming a row of its own. */
  onBack: () => void,
}

/**
 * Retrace to the empty state — an arrow, not an ×: it returns you to where you came
 * from rather than discarding the answer, the same way the detail modal's Back reads.
 */
function BackButton({ onBack }: { onBack: () => void }) {
  const strings = useStrings();
  return (
    <Tooltip label={strings.oracle.backToStartTooltip} withArrow openDelay={300}>
      <ActionIcon variant="subtle" color="gray" onClick={onBack} aria-label={strings.common.backAriaLabel}>
        <IconArrowLeft size={18} />
      </ActionIcon>
    </Tooltip>
  );
}

export function ResultsPanel({
  result,
  loading,
  loadingMore,
  onShowMore,
  onOpenJunk,
  fillHeight,
  onBack,
}: ResultsPanelProps) {
  const strings = useStrings();
  const wizda = useWizda();
  const {
    value: nameFilter,
    setValue: setNameFilter,
    debounced: debouncedNameFilter,
    compositionProps: nameFilterCompositionProps,
  } = useDebouncedSearch();
  // "You were here": the last junk row whose detail was opened, tinted once the
  // modal closes so you re-orient to where you left off. Only the most recent one
  // is tracked — same soft branded highlight the detail modal uses on pop-back.
  const [lastVisited, setLastVisited] = useState<string | null>(null);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Index of the first freshly-loaded row, captured right before a "Show more"
  // fetch — once the new rows land, we smooth-scroll them into view.
  const showMoreAnchorRef = useRef<number | null>(null);

  const entries = useMemo<JunkGuaranteeEntry[]>(() => {
    if (!result) {
      return [];
    }
    if (!debouncedNameFilter.trim()) {
      return result.results;
    }
    // Match on the localized display name — it's what the player sees and types —
    // plus, in Japanese, the reading, so a kana query reaches a name in kanji.
    // Shares the catalogue matcher rather than a bare `includes`, so this filter
    // gets the same aliasing and script folding as every other search box.
    const matcher = createSearchMatcher(debouncedNameFilter);
    return result.results.filter((entry) => matcher.matchesNormalized(
      [entry.junkDisplayName, entry.junkNameReading]
        .filter((text): text is string => Boolean(text))
        .map(normalize),
    ));
  }, [result, debouncedNameFilter]);

  const isFiltering = nameFilter.trim() !== "";

  // Anchored against the *filtered* row count, not the raw result length, so the
  // scroll lands on the first new row the user can actually see. With a filter
  // on, the fresh page may match nothing — the effect's bounds check no-ops then.
  const handleShowMore = () => {
    showMoreAnchorRef.current = entries.length;
    onShowMore();
  };

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  // Once "Show more" rows land (loadingMore drops back to false), smooth-scroll
  // the list so the first newly-loaded row comes into view.
  useEffect(() => {
    if (loadingMore || showMoreAnchorRef.current === null) {
      return;
    }
    const anchor = showMoreAnchorRef.current;
    showMoreAnchorRef.current = null;
    if (anchor < entries.length) {
      virtualizer.scrollToIndex(anchor, { align: 'center', behavior: 'smooth', });
    }
  }, [loadingMore, entries.length, virtualizer]);

  if (loading) {
    return (
      <Center mih={200}>
        <Loader color="crimson" />
      </Center>
    );
  }

  if (!result) {
    return null;
  }

  // No header to ride along here, so the arrow sits beside the alert rather than
  // above it — this is the state a way back matters most in, so it can't be skipped.
  if (result.results.length === 0) {
    return (
      <Group wrap="nowrap" align="flex-start" gap="xs">
        <BackButton onBack={onBack} />
        <Alert
          color="crimson"
          variant="light"
          icon={<IconInfoCircle />}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Text className="wizda-speech">
            {wizda.oracle.noResults}
          </Text>
        </Alert>
      </Group>
    );
  }

  const showEstimate = Boolean(result.estimated);

  return (
    <Stack gap="sm" h={fillHeight ? "100%" : undefined} style={fillHeight ? { minHeight: 0 } : undefined}>
      <Group justify="space-between" align="center" gap="xs">
        <Group gap={6} wrap="nowrap">
          <BackButton onBack={onBack} />
          <Text fw={600}>
            {strings.oracle.resultsCount(result.total)}
          </Text>
          {showEstimate && (
            <Tooltip label={strings.oracle.blessingOddsTooltip} withArrow>
              <ActionIcon
                variant="subtle"
                color="yellow"
                size="sm"
                radius="xl"
                aria-label={strings.oracle.blessingOddsAriaLabel}
                onClick={() => setEstimateOpen(true)}
              >
                <IconAlertTriangle size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        <TextInput
          size="xs"
          w={{ base: 130, xs: 220 }}
          placeholder={strings.oracle.filterByNamePlaceholder}
          leftSection={<IconSearch size={14} />}
          value={nameFilter}
          onChange={(event) => setNameFilter(event.currentTarget.value)}
          {...nameFilterCompositionProps}
        />
      </Group>

      {/* Column headers */}
      <Group justify="space-between" wrap="nowrap" px="sm" gap="lg">
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">{strings.oracle.columnJunk}</Text>
        <Group gap="sm" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" w={NUM_COL} ta="right" visibleFrom="xs">
              {strings.oracle.columnPercentPerJunk}
            </Text>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" w={NUM_COL} ta="right">{strings.oracle.columnNumRequired}</Text>
          </Group>
          <Box w={CHEVRON_COL} />
        </Group>
      </Group>

      <Box
        ref={scrollRef}
        style={fillHeight
          ? { flex: 1, minHeight: 0, overflowY: "auto" }
          : { height: LIST_HEIGHT, overflowY: "auto" }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const entry = entries[virtualRow.index]!;
            const visited = entry.junkName === lastVisited;
            return (
              <div
                key={entry.junkName}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: 8,
                }}
              >
                <UnstyledButton
                  w="100%"
                  h={ROW_HEIGHT - 8}
                  onClick={() => {
                    onOpenJunk(entry);
                    setLastVisited(entry.junkName);
                  }}
                >
                  <Paper
                    withBorder
                    p="sm"
                    h="100%"
                    radius="md"
                    // Shared row treatment: grey hover affordance + the "you were
                    // here" branded tint on the last-visited row. Hover keeps
                    // winning on that row via its higher (:hover) specificity.
                    className={visited ? "wizda-row-hover wizda-row-focused" : "wizda-row-hover"}
                  >
                    <Group justify="space-between" wrap="nowrap" h="100%" gap="lg">
                      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                        <Text truncate fw={500}>{entry.junkDisplayName}</Text>
                        {entry.hasMultiplePools && (
                          <ThemeIcon variant="subtle" color="yellow" size="sm">
                            <IconInfoCircle size={16} />
                          </ThemeIcon>
                        )}
                      </Group>
                      <Group gap="sm" wrap="nowrap">
                        <Group gap="lg" wrap="nowrap">
                          <Text size="xs" c="dimmed" w={NUM_COL} ta="right" visibleFrom="xs">
                            {formatPercent(entry.probabilityPerJunk)}
                          </Text>
                          <Text fw={700} c="crimson.4" fz="1.25rem" w={NUM_COL} ta="right">
                            {entry.junkNeeded.toLocaleString()}
                          </Text>
                        </Group>
                        {ROW_CHEVRON}
                      </Group>
                    </Group>
                  </Paper>
                </UnstyledButton>
              </div>
            );
          })}
        </div>

        {/* Lives inside the scroll container, right after the last row, so it
            only comes into view once the user scrolls to the end of the list.
            Shown while filtering too: the filter only searches the rows already
            loaded, so hiding "Show more" here made a low-rate junk that simply
            hadn't been fetched yet look like it was missing from our data. */}
        <Stack gap="xs" py="sm" align="center">
          {isFiltering && entries.length === 0 && (
            <Text c="dimmed" ta="center" size="sm">{wizda.oracle.noFilterMatches}</Text>
          )}
          {result.hasMore ? (
            <>
              {isFiltering && (
                <Text className="wizda-speech" ta="center" size="sm">
                  <WizdaMark glyph={WizdaGlyph.info} />{wizda.oracle.filterSearchesLoadedOnly}
                </Text>
              )}
              <Button
                variant="light"
                color="crimson"
                onClick={handleShowMore}
                loading={loadingMore}
              >
                {strings.oracle.showMoreButton}
              </Button>
            </>
          ) : (
            <Text className="wizda-speech" ta="center">
              <WizdaMark glyph={WizdaGlyph.welcome} />{wizda.oracle.endOfList}
            </Text>
          )}
        </Stack>
      </Box>

      {/* The one assumption behind blessing-filtered results */}
      <Modal
        opened={estimateOpen}
        onClose={() => setEstimateOpen(false)}
        title={strings.oracle.estimateModalTitle}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text className="wizda-speech"><WizdaMark glyph={WizdaGlyph.info} />{wizda.oracle.estimateNote}</Text>
          <Text size="sm" c="dimmed">
            {wizda.oracle.estimateNoteLink}{' '}
            <Anchor
              href={CALCULATION_DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              inherit
            >
              {strings.oracle.calculationDocLinkLabel}
            </Anchor>{' '}
            {strings.oracle.estimateFooterSuffix}
          </Text>
        </Stack>
      </Modal>
    </Stack>
  );
}
