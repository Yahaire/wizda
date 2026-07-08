'use client';

import { useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconInfoCircle,
  IconSearch,
} from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { useDetail } from '@/components/detail/DetailProvider';
import { WizdaEmoji } from '@/mascot/wizda';

import { TsUtilities } from '@shared/tsUtilities';
import type {
  CertaintyCurveResult,
  JunkGuaranteeEntry,
  JunkToGuaranteeResult,
} from '@shared/api/endpoints/junkToGuarantee.models';

import { CertaintyCurve } from './CertaintyCurve';

const ROW_HEIGHT = 64;
const LIST_HEIGHT = 460;
const NUM_COL = 76;
const CHEVRON_COL = 16;

// Tap affordance on each result row (there's no hover on touch). The header
// reserves an equal-width empty slot so the number columns stay aligned with it.
const ROW_CHEVRON = <IconChevronRight size={CHEVRON_COL} style={{ opacity: 0.4, flexShrink: 0 }} />;

const MULTI_POOL_NOTE = TsUtilities.stringJoin([
  "Rates shown are for the latest version of this junk.",
  "If you haven't completed the progression that unlocks this area's newer pool,",
  "or you still have junks left from the previous version,",
  "your actual drops may differ.",
]);

const ESTIMATE_NOTE = TsUtilities.stringJoin([
  "These numbers are a careful estimate.",
  "Blessings roll on their own slots, so I work out the combined odds rather than",
  "reading them straight off a single table.",
  "They'll be close — treat them as a solid guide rather than a promise.",
]);

function formatPercent(probability: number): string {
  const percent = probability * 100;
  if (percent >= 1) {
    return `${percent.toFixed(1)}%`;
  }
  if (percent <= 0) {
    return "0%";
  }
  return `${percent.toPrecision(2)}%`;
}

interface ResultsPanelProps {
  result: JunkToGuaranteeResult | null,
  loading: boolean,
  loadingMore: boolean,
  onShowMore: () => void,
  /** The certainty the query used, as a whole percent — centres the detail curve. */
  certaintyPct: number,
  /** Fetches a junk's certainty curve for the detail modal (see {@link CertaintyCurve}). */
  onRequestCurve: (junkName: string, certainties: number[]) => Promise<CertaintyCurveResult>,
  /**
   * When set, the row list stretches to fill its parent instead of using a
   * fixed height — the parent is expected to cap its own height in that case
   * (see the `resultsMaxHeight` measurement in {@link OraclePage}).
   */
  fillHeight?: boolean,
}

export function ResultsPanel({
  result,
  loading,
  loadingMore,
  onShowMore,
  certaintyPct,
  onRequestCurve,
  fillHeight,
}: ResultsPanelProps) {
  const [nameFilter, setNameFilter] = useState("");
  const [detail, setDetail] = useState<JunkGuaranteeEntry | null>(null);
  // "You were here": the last junk row whose detail we opened, tinted once the
  // modal closes so you re-orient to where you left off. Only the most recent one
  // is tracked — same soft branded highlight the detail modal uses on pop-back.
  const [lastVisited, setLastVisited] = useState<string | null>(null);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openJunk } = useDetail();

  // Hand off to the shared junk detail modal (drops list + cross-links). We leave
  // this compact per-result view mounted behind it and open the shared modal as
  // "backable", so its Back arrow closes it and reveals this summary again —
  // reading as a step back in the navigation rather than a plain close.
  const seeFullJunkDetails = (junkName: string) => {
    openJunk(junkName, true);
  };

  const entries = useMemo<JunkGuaranteeEntry[]>(() => {
    if (!result) {
      return [];
    }
    const needle = nameFilter.trim().toLowerCase();
    if (!needle) {
      return result.results;
    }
    return result.results.filter((entry) => entry.junkName.toLowerCase().includes(needle));
  }, [result, nameFilter]);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

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

  if (result.results.length === 0) {
    return (
      <Alert color="crimson" variant="light" icon={<IconInfoCircle />}>
        <Text className="wizda-speech">
          No junk can get you that one — try loosening the filters a little.
        </Text>
      </Alert>
    );
  }

  const showEstimate = Boolean(result.estimated);

  return (
    <Stack gap="sm" h={fillHeight ? "100%" : undefined} style={fillHeight ? { minHeight: 0 } : undefined}>
      <Group justify="space-between" align="center" gap="xs">
        <Group gap={6} wrap="nowrap">
          <Text fw={600}>
            {result.total} {result.total === 1 ? "junk" : "junks"} can get it
          </Text>
          {showEstimate && (
            <Tooltip label="These are estimates — tap to learn why" withArrow>
              <ActionIcon
                variant="subtle"
                color="yellow"
                size="sm"
                radius="xl"
                aria-label="Why these are estimates"
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
          placeholder="Filter by name"
          leftSection={<IconSearch size={14} />}
          value={nameFilter}
          onChange={(event) => setNameFilter(event.currentTarget.value)}
        />
      </Group>

      {/* Column headers */}
      <Group justify="space-between" wrap="nowrap" px="sm" gap="lg">
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">Junk</Text>
        <Group gap="sm" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" w={NUM_COL} ta="right" visibleFrom="xs">
              %/junk
            </Text>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" w={NUM_COL} ta="right"># req.</Text>
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
                    setDetail(entry);
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
                        <Text truncate fw={500}>{entry.junkName}</Text>
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
      </Box>

      {entries.length === 0 && (
        <Text c="dimmed" ta="center" size="sm">No junk matches that name.</Text>
      )}

      {result.hasMore && nameFilter.trim() === "" && (
        <Center>
          <Button
            variant="light"
            color="crimson"
            onClick={onShowMore}
            loading={loadingMore}
          >
            Show more
          </Button>
        </Center>
      )}

      {/* Per-junk detail — recovers the full name when it's been truncated. */}
      <Modal
        opened={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Junk details"
        centered
        size="md"
      >
        {detail && (
          <Stack gap="sm">
            <Text fw={600} fz="lg">{detail.junkName}</Text>
            <Divider />
            <Group justify="space-between">
              <Text c="dimmed">Chance per junk</Text>
              <Text fw={500}>{formatPercent(detail.probabilityPerJunk)}</Text>
            </Group>
            <div>
              <Text c="dimmed" mb="xs">Junk needed by certainty</Text>
              <CertaintyCurve
                junkName={detail.junkName}
                selectedPct={certaintyPct}
                onRequestCurve={onRequestCurve}
              />
            </div>
            {detail.hasMultiplePools && (
              <Alert color="yellow" variant="light" icon={<IconInfoCircle />} mt="xs">
                {MULTI_POOL_NOTE}
              </Alert>
            )}
            <Button
              variant="light"
              color="crimson"
              mt="xs"
              rightSection={<IconChevronRight size={16} />}
              onClick={() => seeFullJunkDetails(detail.junkName)}
            >
              See full junk details
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Estimate explanation */}
      <Modal
        opened={estimateOpen}
        onClose={() => setEstimateOpen(false)}
        title="About these estimates"
        centered
        size="md"
      >
        <Text className="wizda-speech">{WizdaEmoji.info} {ESTIMATE_NOTE}</Text>
      </Modal>
    </Stack>
  );
}
