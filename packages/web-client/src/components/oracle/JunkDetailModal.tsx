'use client';

import { useEffect, useMemo, useState } from 'react';

import { ShareButton } from '@/components/ShareButton';
import { useStrings } from '@/i18n/LanguageProvider';
import {
    Alert, Button, Center, Divider, FocusTrap, Group, Loader, Modal, Stack, Text
} from '@mantine/core';
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
    // The compound API, not the `<Modal title>` shorthand: the share button
    // needs to sit in the header beside the title, which the shorthand has no
    // slot for. `entry`'s URL (`&junk=…`) is already live by the time this is
    // visible — `OraclePage` pushes it in the same handler that opens the
    // modal — so the button needs no special-casing here, same as everywhere
    // else it's used.
    <Modal.Root opened={Boolean(entry)} onClose={onClose} centered size="md">
      <Modal.Overlay />
      <Modal.Content>
        {/* Mantine's focus trap auto-focuses the first focusable element once
            the modal opens — without this, that's the share button, so a
            visitor landing straight on a shared `&junk=` link (having
            clicked/tapped nothing themselves) sees it wearing a focus ring
            for no reason. This invisible marker (tabIndex -1, `data-autofocus`)
            gives the trap somewhere to land that draws nothing. */}
        <FocusTrap.InitialFocus />
        <Modal.Header>
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Modal.Title>{strings.oracle.junkDetailsTitle}</Modal.Title>
            {entry && <ShareButton />}
          </Group>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
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
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
