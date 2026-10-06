'use client';

import { useStrings } from '@/i18n/LanguageProvider';
import { Paper, SimpleGrid, Text } from '@mantine/core';

import {
    EnhancementFormState, hasMilestoneAhead, isPieceReady, MAX_ENHANCEMENT_LEVEL, PreviewFace,
    previewSlots
} from './enhancement.logic';
import { PieceCard } from './PieceCard';

import type { EnhancementSlotOutcome } from '@shared/api/endpoints/enhancementOdds.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

/**
 * Below this breakpoint the page is one column, and the previews drop out:
 * stacked under the whole form, a "live" picture is out of view while the
 * player types into it, and only takes space on the way to the result. The
 * page's own form/result split keys off the same value, so the previews can't
 * appear in a layout where the form isn't beside them.
 */
export const PREVIEW_BREAKPOINT = 'md';

/** The width from which the two faces sit side by side rather than stacked. */
const SIDE_BY_SIDE_BREAKPOINT = 'lg';

/** The space a card will occupy, saying what would fill it. */
function GhostCard({ children }: { children: string }) {
  return (
    <Paper
      radius="md"
      p="md"
      withBorder
      bg="var(--mantine-color-dark-8)"
      style={{ borderStyle: 'dashed' }}
    >
      <Text c="dimmed" fz="sm" ta="center">{children}</Text>
    </Paper>
  );
}

interface PieceFaceProps {
  state: EnhancementFormState,
  item: EquipmentListItem,
  /** Per-slot outcome for the WANT face, when a result for this exact form exists. */
  outcome?: EnhancementSlotOutcome[],
}

/** The piece as the item screen shows it now. */
export function HaveCard({ state, item }: PieceFaceProps) {
  return (
    <PieceCard
      face={PreviewFace.HAVE}
      item={item}
      quality={state.quality!}
      level={state.enhancementLevel}
      slots={previewSlots(PreviewFace.HAVE, state.slots, state)}
    />
  );
}

/**
 * The piece at the target level, or — when no milestone lies on the way there
 * — the reason there is nothing to draw: a picture identical to the one beside
 * it would only invite a hunt for the difference.
 */
export function WantCard({ state, item, outcome }: PieceFaceProps) {
  const strings = useStrings();

  if (!hasMilestoneAhead(state)) {
    return (
      <GhostCard>
        {state.enhancementLevel >= MAX_ENHANCEMENT_LEVEL
          ? strings.enhancement.previewFullyEnhanced
          : strings.enhancement.previewPickTarget(state.enhancementLevel)}
      </GhostCard>
    );
  }

  return (
    <PieceCard
      face={PreviewFace.WANT}
      item={item}
      quality={state.quality!}
      level={state.targetEnhancementLevel}
      slots={previewSlots(PreviewFace.WANT, state.slots, state)}
      outcome={outcome}
    />
  );
}

interface PiecePreviewProps {
  state: EnhancementFormState,
  /** The piece behind `state.equipment`, resolved from the catalogue; null until both exist. */
  item: EquipmentListItem | null,
  outcome?: EnhancementSlotOutcome[],
}

/**
 * The two faces of the piece, side by side above the result: what the form
 * describes, and what the player hopes it becomes. Redrawn from the form on
 * every change, with no request behind it. Before a piece is picked, two
 * ghosts hold the space so the column reads as *for* something.
 */
export function PiecePreview({ state, item, outcome }: PiecePreviewProps) {
  const strings = useStrings();
  const ready = isPieceReady(state) && item !== null;

  return (
    <SimpleGrid cols={{ base: 1, [SIDE_BY_SIDE_BREAKPOINT]: 2 }} spacing="md">
      {ready
        ? <HaveCard state={state} item={item} />
        : <GhostCard>{strings.enhancement.previewPickPiece}</GhostCard>}
      {ready
        ? <WantCard state={state} item={item} outcome={outcome} />
        : <GhostCard>{strings.enhancement.previewWantTitle}</GhostCard>}
    </SimpleGrid>
  );
}
