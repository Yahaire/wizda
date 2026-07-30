'use client';

import { useEffect, useMemo, useState } from 'react';

import { useStrings } from '@/i18n/LanguageProvider';
import { Alert, Button, Center, Divider, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { IconChevronRight, IconInfoCircle } from '@tabler/icons-react';

import { CertaintyCurve, CURVE_ROW_HEIGHT } from './CertaintyCurve';
import { certaintyWindow, formatPercent, OracleFilters } from './oracle.logic';
import { QuerySummary } from './QuerySummary';

import type {
  CertaintyCurveResult,
  JunkGuaranteeEntry,
} from '@shared/api/endpoints/junkToGuarantee.models';

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
  const strings = useStrings();
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
      title={strings.oracle.junkDetailsTitle}
      centered
      size="md"
    >
      {entry && (
        <Stack gap="sm">
          <Text fw={600} fz="lg">{entry.junkDisplayName}</Text>

          <QuerySummary filters={queryFilters} matched={curve?.matched ?? null} />

          <Divider label={strings.detail.junkNeededByCertainty} labelPosition="center" />

          {status === 'loading' && (
            <Center mih={CURVE_MIN_HEIGHT}>
              <Loader size="sm" color="crimson" />
            </Center>
          )}
          {status === 'error' && (
            <Text size="sm" c="dimmed" ta="center">
              {strings.oracle.curveLoadError(entry.junkNeeded.toLocaleString())}
            </Text>
          )}
          {status === 'ready' && curve && (
            <CertaintyCurve points={curve.points} percents={percents} selectedPct={selectedPct} />
          )}

          <Group justify="space-between">
            <Text c="dimmed" fz="xs">{strings.oracle.chancePerJunk}</Text>
            <Text c="dimmed" fz="xs">{formatPercent(entry.probabilityPerJunk)}</Text>
          </Group>

          {entry.hasMultiplePools && (
            <Alert color="yellow" variant="light" icon={<IconInfoCircle />}>
              {strings.oracle.multiPoolNote}
            </Alert>
          )}

          <Button
            variant="light"
            color="crimson"
            rightSection={<IconChevronRight size={16} />}
            onClick={() => onSeeFullDetails(entry.junkName)}
          >
            {strings.oracle.seeFullDetailsButton}
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
