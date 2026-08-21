'use client';

import { APP_NAME, SITE_URL } from '@/app/app.constants';
import { useStrings } from '@/i18n/LanguageProvider';
import { Alert, Box, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { CertaintyCurve } from './CertaintyCurve';
import { formatCertaintyPct, formatPercent, OracleFilters } from './oracle.logic';
import { QuerySummary } from './QuerySummary';

import type { CertaintyCurvePoint, MatchedOutcome } from '@shared/api/endpoints/junkToGuarantee.models';

/**
 * The width the card is laid out at, in CSS pixels. Deliberately close to the
 * detail modal's own `size="md"` (~520px) so every child below renders at the
 * proportions it was designed for — the card is scaled up at *rasterization*
 * time (`SHARE_CARD_PIXEL_RATIO` in `shareCard.ts`), not by re-laying it out
 * bigger, which is what lets the styling be shared rather than re-tuned.
 */
export const SHARE_CARD_WIDTH = 560;

const HEADER_HEIGHT = 64;

interface JunkShareCardProps {
  /** The junk's localized display name — the card's identity line. */
  junkDisplayName: string,
  /** The headline count: junk needed at the selected certainty. */
  junkNeeded: number,
  /** Per-junk drop probability, 0–1. */
  probabilityPerJunk: number,
  /** Whether the source page listed this junk's table more than once — see CLAUDE.md. */
  hasMultiplePools: boolean,
  /** The filters that produced the result — snapshotted, not the live selection. */
  queryFilters: OracleFilters,
  /** The query resolved against this junk; null if the curve request hasn't landed. */
  matched: MatchedOutcome | null,
  /** One point per entry of {@link percents}, in the same order. */
  points: CertaintyCurvePoint[],
  /** The certainty levels charted, ascending (see `certaintyWindow`). */
  percents: number[],
  /**
   * Points at the node the rasterizer captures. It must be *this* element and
   * not the off-screen wrapper around it: `html-to-image` copies the captured
   * node's full computed style into the clone, so a captured wrapper would
   * carry its own `position: fixed; left: -10000px` into the output and
   * rasterize to nothing.
   */
  ref?: React.Ref<HTMLDivElement>,
}

/**
 * The shareable picture of a junk result — the same thing {@link JunkDetailModal}
 * shows, composed for a static image instead of a live dialog.
 *
 * Rendered off-screen inside the modal's own tree (so it inherits the Mantine
 * theme, the language catalog and `DetailProvider`) and rasterized on demand by
 * `shareCard.ts`. It is *not* a screenshot of the modal, and can't be: three
 * things differ deliberately.
 *
 * - The header band carries the site's name, not "Junk details" — a picture
 *   pasted into Discord has to say where it came from.
 * - The footer is the tool's URL where the modal has its "see full details"
 *   button, for the same reason: a static image can't be clicked.
 * - The count gets a headline of its own, far larger than anything in the
 *   modal. On screen the crimson row in the curve is enough because the reader
 *   arrived by asking the question; in a feed the number *is* the post.
 *
 * Everything else — {@link QuerySummary}, {@link CertaintyCurve}, the
 * chance-per-junk line, the multi-pool caveat — is the modal's own component at
 * the modal's own size, so a theme change lands in both at once and there is
 * no second renderer to keep in sync.
 */
export function JunkShareCard({
  junkDisplayName,
  junkNeeded,
  probabilityPerJunk,
  hasMultiplePools,
  queryFilters,
  matched,
  points,
  percents,
  ref,
}: JunkShareCardProps) {
  const strings = useStrings();

  return (
    <Box
      ref={ref}
      w={SHARE_CARD_WIDTH}
      bg="var(--mantine-color-dark-9)"
      // Explicit rather than inherited: the rasterizer paints only this
      // subtree, so an unset background would come out transparent — which
      // reads as white the moment anyone views the PNG on a light backdrop.
      style={{ color: 'var(--mantine-color-dark-0)', overflow: 'hidden' }}
    >
      <Group h={HEADER_HEIGHT} px="lg" bg="var(--mantine-color-crimson-6)" align="center">
        <Title
          order={2}
          fz="1.5rem"
          c="white"
          style={{ letterSpacing: '0.08em' }}
        >
          {APP_NAME}
        </Title>
      </Group>

      <Stack gap="sm" p="lg">
        <QuerySummary filters={queryFilters} matched={matched} variant="card" />

        {/* The card's whole claim, as one block: how many, of what, at what
            confidence. The junk's name sits *inside* it rather than titling
            the card — on its own up top it read as a heading the eye had to
            get past, where here it's the middle term of a sentence the count
            starts and the certainty finishes. The modal keeps its own name
            line: it has a real title bar above it, which this has not. */}
        <Stack gap={2} align="center">
          {/* Roughly double the relative weight the count carries in the
              modal, where the crimson curve row is emphasis enough — a reader
              scrolling a feed has to get the answer before deciding whether
              to read anything else. */}
          <Text fz="4.5rem" fw={800} c="crimson.4" lh={1.1}>
            {junkNeeded.toLocaleString()}
          </Text>
          <Text fw={600} fz="lg" ta="center">{junkDisplayName}</Text>
          <Text c="dimmed" fz="sm">
            {formatCertaintyPct(queryFilters.certaintyPct)} {strings.oracle.certaintyLabel}
          </Text>
        </Stack>

        <Divider label={strings.detail.junkNeededByCertainty} labelPosition="center" />

        <CertaintyCurve
          points={points}
          percents={percents}
          selectedPct={queryFilters.certaintyPct}
          animated={false}
        />

        <Group justify="space-between">
          <Text c="dimmed" fz="xs">{strings.oracle.chancePerJunk}</Text>
          <Text c="dimmed" fz="xs">{formatPercent(probabilityPerJunk)}</Text>
        </Group>

        {hasMultiplePools && (
          <Alert color="yellow" variant="light" icon={<IconInfoCircle />} p="xs">
            <Text fz="xs">{strings.oracle.multiPoolNote}</Text>
          </Alert>
        )}

        {/* The host and tool path only, never the live query string: a filter
            naming dozens of equipment would make an unreadable watermark, and
            the point of the image is the picture — the link is the *other*
            share item. */}
        <Text c="dimmed" fz="sm" ta="center" mt={4}>
          {new URL(SITE_URL).host}/junk-oracle
        </Text>
      </Stack>
    </Box>
  );
}
