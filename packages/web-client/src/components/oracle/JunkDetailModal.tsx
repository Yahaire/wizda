'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { APP_NAME } from '@/app/app.constants';
import { ShareMenu } from '@/components/ShareMenu';
import { useStrings, useWizda } from '@/i18n/LanguageProvider';
import { wizdaSay } from '@/mascot/wizda';
import {
    deliverJunkDetailImage, renderJunkDetailCard, SHARE_CARD_OFFSCREEN_STYLE
} from '@/utils/shareCard';
import {
    Alert, Box, Button, Center, Divider, FocusTrap, Group, Loader, Modal, Stack, Text
} from '@mantine/core';
import { IconChevronRight, IconInfoCircle } from '@tabler/icons-react';

import { CertaintyCurve, CURVE_ROW_HEIGHT } from './CertaintyCurve';
import { JunkShareCard } from './JunkShareCard';
import { certaintyWindow, formatPercent, OracleFilters } from './oracle.logic';
import { QuerySummary } from './QuerySummary';

import type {
  CertaintyCurvePoint,
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
  const wizda = useWizda();
  const selectedPct = queryFilters.certaintyPct;
  const percents = useMemo(() => certaintyWindow(selectedPct), [selectedPct]);

  const [curve, setCurve] = useState<CertaintyCurveResult | null>(null);
  const [status, setStatus] = useState<CurveStatus>('loading');
  const shareCardRef = useRef<HTMLDivElement>(null);

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

  /**
   * The three-point window as the share card should draw it, which is not
   * quite what the modal draws: the card is shareable the instant the modal
   * is, without waiting on the curve fetch above. The headline number and
   * chance-per-junk both come straight off `entry`, which is already final;
   * only the neighbouring two points need the request, and a click fast
   * enough to beat it (typically near-instant) gets "—" for those —
   * `CertaintyCurve`'s own null-point rendering — while the selected row is
   * covered by `entry.junkNeeded` either way.
   */
  const shareCardPoints = useMemo<CertaintyCurvePoint[]>(() => percents.map((pct, index) => {
    const selected = Math.abs(pct - selectedPct) < 1e-9;
    const fallback = selected ? entry?.junkNeeded ?? null : null;
    return {
      certainty: pct / 100,
      junkNeeded: curve?.points[index]?.junkNeeded ?? fallback,
    };
  }), [percents, selectedPct, curve, entry]);

  /**
   * Rasterizes the off-screen {@link JunkShareCard} and delivers it (see
   * `shareCard.ts`). The card is mounted for as long as the modal is open
   * rather than spun up on click, so there is no layout frame to wait for
   * here and no chance of capturing it half-laid-out.
   */
  const handleShareImage = async () => {
    const card = shareCardRef.current;
    if (!entry || !card) {
      return;
    }
    try {
      const blob = await renderJunkDetailCard(card);
      const method = await deliverJunkDetailImage(blob, {
        title: `${APP_NAME} — ${entry.junkDisplayName}`,
        filename: 'wizda-junk-oracle.png',
      });
      if (method === 'clipboard') {
        wizdaSay(wizda.share.imageCopied);
      } else if (method === 'download') {
        wizdaSay(wizda.share.imageSaved);
      }
    } catch {
      wizdaSay(wizda.share.imageFailed);
    }
  };

  return (
    // The compound API, not the `<Modal title>` shorthand: the share menu
    // needs to sit in the header beside the title, which the shorthand has no
    // slot for. Its "Link" item needs no special-casing — `entry`'s URL
    // (`&junk=…`) is already live by the time this is visible, since
    // `OraclePage` pushes it in the same handler that opens the modal.
    <Modal.Root opened={Boolean(entry)} onClose={onClose} centered size="md">
      <Modal.Overlay />
      <Modal.Content>
        {/* Mantine's focus trap auto-focuses the first focusable element once
            the modal opens — without this, that's the share menu's trigger,
            so a visitor landing straight on a shared `&junk=` link (having
            clicked/tapped nothing themselves) sees it wearing a focus ring
            for no reason. This invisible marker (tabIndex -1, `data-autofocus`)
            gives the trap somewhere to land that draws nothing. */}
        <FocusTrap.InitialFocus />
        <Modal.Header>
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Modal.Title>{strings.oracle.junkDetailsTitle}</Modal.Title>
            {entry && <ShareMenu onShareImage={handleShareImage} />}
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

              {/* The shareable picture, parked off-screen (see
                  `SHARE_CARD_OFFSCREEN_STYLE`) so it is fully laid out the
                  moment the share menu is used. Mounted here, inside the
                  modal's own tree, because it renders the very same
                  components and needs the very same context — the Mantine
                  theme, the language catalog, and `DetailProvider`'s
                  equipment list. */}
              <Box style={SHARE_CARD_OFFSCREEN_STYLE} aria-hidden>
                <JunkShareCard
                  ref={shareCardRef}
                  junkDisplayName={entry.junkDisplayName}
                  junkNeeded={entry.junkNeeded}
                  probabilityPerJunk={entry.probabilityPerJunk}
                  hasMultiplePools={entry.hasMultiplePools}
                  queryFilters={queryFilters}
                  matched={curve?.matched ?? null}
                  points={shareCardPoints}
                  percents={percents}
                />
              </Box>
            </Stack>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
