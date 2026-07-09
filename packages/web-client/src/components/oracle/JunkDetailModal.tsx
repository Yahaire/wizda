'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert, Button, Center, Divider, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { TsUtilities } from '@shared/tsUtilities';
import { IconChevronRight, IconInfoCircle } from '@tabler/icons-react';

import { CertaintyCurve, CURVE_ROW_HEIGHT } from './CertaintyCurve';
import { certaintyWindow, formatPercent, OracleFilters } from './oracle.logic';
import { QuerySummary } from './QuerySummary';

import type {
  CertaintyCurveResult,
  JunkGuaranteeEntry,
} from '@shared/api/endpoints/junkToGuarantee.models';

const MULTI_POOL_NOTE = TsUtilities.stringJoin([
  "Rates shown are for the latest version of this junk.",
  "If you haven't completed the progression that unlocks this area's newer pool,",
  "or you still have junks left from the previous version,",
  "your actual drops may differ.",
]);

/** Three rows plus the Stack's gaps — reserved so the curve doesn't jump in on load. */
const CURVE_MIN_HEIGHT = 3 * CURVE_ROW_HEIGHT + 20;

type CurveStatus = 'loading' | 'ready' | 'error';

interface JunkDetailModalProps {
  /** The result row being inspected; null closes the modal. */
  entry: JunkGuaranteeEntry | null,
  onClose: () => void,
  /** The filters that produced the result — snapshotted, not the live selection. */
  queryFilters: OracleFilters,
  onRequestCurve: (junkName: string, certainties: number[]) => Promise<CertaintyCurveResult>,
  /** Hand off to the shared junk detail view (drops list + cross-links). */
  onSeeFullDetails: (junkName: string) => void,
}

/**
 * One result row, expanded: what was asked for, and what this junk costs to deliver it.
 *
 * Owns the curve request because a single response feeds both children — the points the
 * chart draws, and the `matched` set {@link QuerySummary} needs to describe the query as
 * this junk actually resolves it.
 */
export function JunkDetailModal({
  entry,
  onClose,
  queryFilters,
  onRequestCurve,
  onSeeFullDetails,
}: JunkDetailModalProps) {
  const selectedPct = queryFilters.certaintyPct;
  const percents = useMemo(() => certaintyWindow(selectedPct), [selectedPct]);

  const [curve, setCurve] = useState<CertaintyCurveResult | null>(null);
  const [status, setStatus] = useState<CurveStatus>('loading');

  const junkName = entry?.junkName ?? null;
  useEffect(() => {
    if (!junkName) {
      return;
    }
    let cancelled = false;
    setCurve(null);
    setStatus('loading');
    onRequestCurve(junkName, percents.map((pct) => pct / 100))
      .then((result) => {
        if (!cancelled) {
          setCurve(result);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [junkName, percents, onRequestCurve]);

  return (
    <Modal
      opened={Boolean(entry)}
      onClose={onClose}
      title="Junk details"
      centered
      size="md"
    >
      {entry && (
        <Stack gap="sm">
          <Text fw={600} fz="lg">{entry.junkName}</Text>

          <QuerySummary filters={queryFilters} matched={curve?.matched ?? null} />

          <Divider label="Junk needed by certainty" labelPosition="center" />

          {status === 'loading' && (
            <Center mih={CURVE_MIN_HEIGHT}>
              <Loader size="sm" color="crimson" />
            </Center>
          )}
          {status === 'error' && (
            <Text size="sm" c="dimmed" ta="center">
              Couldn&apos;t chart the curve — but you&apos;ll still need about{' '}
              {entry.junkNeeded.toLocaleString()} of these.
            </Text>
          )}
          {status === 'ready' && curve && (
            <CertaintyCurve points={curve.points} percents={percents} selectedPct={selectedPct} />
          )}

          <Group justify="space-between">
            <Text c="dimmed" fz="xs">Chance per junk</Text>
            <Text c="dimmed" fz="xs">{formatPercent(entry.probabilityPerJunk)}</Text>
          </Group>

          {entry.hasMultiplePools && (
            <Alert color="yellow" variant="light" icon={<IconInfoCircle />}>
              {MULTI_POOL_NOTE}
            </Alert>
          )}

          <Button
            variant="light"
            color="crimson"
            rightSection={<IconChevronRight size={16} />}
            onClick={() => onSeeFullDetails(entry.junkName)}
          >
            See full junk details
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
