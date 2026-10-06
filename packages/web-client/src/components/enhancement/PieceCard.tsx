'use client';

import { useState } from 'react';

import { QualityStarRow } from '@/components/gear/gearDisplays';
import { getEquipmentIcon } from '@/components/oracle/equipmentOptions';
import { blessingLabel, formatPercent } from '@/components/oracle/oracle.logic';
import { gradeTextStyle } from '@/components/oracle/querySubject';
import { useStrings } from '@/i18n/LanguageProvider';
import {
    Badge, Divider, Group, Paper, Pill, Stack, Text, Tooltip, UnstyledButton
} from '@mantine/core';
import { IconDiamond } from '@tabler/icons-react';

import {
    formatValueRange, PreviewBlessingSlot, PreviewEmptySlot, PreviewFace, previewGrade, PreviewSlot,
    PreviewWishSlot
} from './enhancement.logic';

import type { EnhancementSlotOutcome } from '@shared/api/endpoints/enhancementOdds.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

/** The piece's category glyph at the card's subject size. */
const SUBJECT_ICON_SIZE = 22;

/**
 * How many of a slot's candidate blessings the card lists before folding the
 * rest behind "+N more". A slot can roll up to 19; a card that lists them all
 * stops being a picture of the piece.
 */
const CANDIDATES_SHOWN = 5;

/** A blank where a number or a name should be — not yet typed, not an error. */
const NOT_YET = '?';

/** A dashed border: the card's way of saying "not a promise". */
const WISH_BORDER = '1px dashed var(--mantine-color-dimmed)';

interface PieceCardProps {
  face: PreviewFace,
  /** The piece, resolved from the catalogue — carries the name, icon and tint. */
  item: EquipmentListItem,
  quality: number,
  /** The enhancement level this face is drawn at: current for HAVE, target for WANT. */
  level: number,
  slots: PreviewSlot[],
  /**
   * The computed outcome per slot, once a result exists *for this very form
   * state*. Only the WANT face reads it: a wish row then lists what a
   * milestone could roll there with its odds, and a boosted row shows the
   * range the value will land in. Absent (or stale) and the card draws the
   * wishes alone.
   */
  outcome?: EnhancementSlotOutcome[],
}

/** A milestone marker: "+10", tinted to say a roll is still ahead. */
function MilestoneChip({ milestone, tooltip, dimmed }: { milestone: number, tooltip: string, dimmed?: boolean }) {
  return (
    <Tooltip label={tooltip} withArrow openDelay={300}>
      <Badge
        size="xs"
        variant={dimmed ? 'outline' : 'light'}
        color={dimmed ? 'gray' : 'crimson'}
        style={{ flexShrink: 0 }}
      >
        {`+${milestone}`}
      </Badge>
    </Tooltip>
  );
}

/** The ★N stone a slot's plan refines it with. */
function RefineTag({ quality }: { quality: number }) {
  const strings = useStrings();
  return (
    <Tooltip label={strings.enhancement.previewRefineTooltip(quality)} withArrow openDelay={300}>
      <Badge
        size="xs"
        variant="light"
        color="blue"
        leftSection={<IconDiamond size={10} />}
        style={{ flexShrink: 0 }}
      >
        {strings.enhancement.previewRefineTag(quality)}
      </Badge>
    </Tooltip>
  );
}

/** A slot number, kept small so the blessing beside it reads first. */
function SlotNumber({ slot }: { slot: number }) {
  return (
    <Text span fz="xs" c="dimmed" w={14} style={{ flexShrink: 0 }}>
      {slot}
    </Text>
  );
}

/** The blessing and value as the item screen writes them: a label on a number. */
function BlessingValue({
  blessingCode,
  value,
  dashed,
}: {
  blessingCode: string | null,
  /** Already formatted — a number, a floor, a range, or a blank. */
  value: string,
  /** Drawn as a wish rather than a fact. */
  dashed?: boolean,
}) {
  const strings = useStrings();
  return (
    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
      <Pill
        style={dashed ? { border: WISH_BORDER, background: 'transparent' } : undefined}
      >
        {blessingCode ? blessingLabel(blessingCode) : (dashed ? strings.enhancement.wishBlessingPlaceholder : NOT_YET)}
      </Pill>
      <Text span fw={600} fz="sm" c={dashed ? 'dimmed' : undefined}>
        {value}
      </Text>
    </Group>
  );
}

function EmptyRow({ slot }: { slot: PreviewEmptySlot }) {
  const strings = useStrings();
  return (
    <Group justify="space-between" wrap="nowrap" style={{ opacity: 0.55 }}>
      <Group gap={6} wrap="nowrap">
        <SlotNumber slot={slot.slot} />
        <Text span fz="sm" c="dimmed" fs="italic">{strings.enhancement.emptyOption}</Text>
      </Group>
      <MilestoneChip
        milestone={slot.fillsAt}
        tooltip={strings.enhancement.slotEmptyUntilHint(slot.fillsAt)}
        dimmed
      />
    </Group>
  );
}

function BlessingRow({ slot, resolved }: { slot: PreviewBlessingSlot, resolved?: EnhancementSlotOutcome }) {
  const strings = useStrings();

  // A computed range beats a wished floor, which beats the number typed in.
  const value = (() => {
    if (slot.boostedAt !== null && resolved?.valueDistribution) {
      return formatValueRange(resolved.valueDistribution);
    }
    if (slot.minValue !== null) {
      return `≥ ${slot.minValue}`;
    }
    return slot.value === null ? NOT_YET : `+${slot.value}`;
  })();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
        <SlotNumber slot={slot.slot} />
        <BlessingValue blessingCode={slot.blessingCode} value={value} />
      </Group>
      <Group gap={4} wrap="nowrap">
        {slot.refineStoneQuality !== null && <RefineTag quality={slot.refineStoneQuality} />}
        {slot.boostedAt !== null && (
          <MilestoneChip
            milestone={slot.boostedAt}
            tooltip={strings.enhancement.previewBoostedAtTooltip(slot.boostedAt)}
          />
        )}
      </Group>
    </Group>
  );
}

/**
 * A wish row: the blessing and floor hoped for, dashed. Once a result for this
 * form exists it opens into what the milestone could actually roll here, best
 * odds first — the one place on the card that is a list rather than a line.
 */
function WishRow({ slot, resolved }: { slot: PreviewWishSlot, resolved?: EnhancementSlotOutcome }) {
  const strings = useStrings();
  const [expanded, setExpanded] = useState(false);

  const candidates = resolved?.candidates ?? [];
  const shown = expanded ? candidates : candidates.slice(0, CANDIDATES_SHOWN);
  const hidden = candidates.length - shown.length;

  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <SlotNumber slot={slot.slot} />
          <BlessingValue
            blessingCode={slot.blessingCode}
            value={slot.minValue !== null ? `≥ ${slot.minValue}` : strings.enhancement.wishAnyPlaceholder}
            dashed
          />
        </Group>
        <MilestoneChip
          milestone={slot.rollsAt}
          tooltip={strings.enhancement.slotFillsAtHint(slot.rollsAt)}
        />
      </Group>

      {candidates.length > 0 && (
        <Tooltip label={strings.enhancement.slotResultCandidatesLabel} withArrow openDelay={300}>
          <Stack gap={2} pl={20}>
            {shown.map((candidate) => (
              <Group key={candidate.blessingCode} justify="space-between" wrap="nowrap" gap="xs">
                {/* The one the player asked for, if they named one, reads first. */}
                <Text span fz="xs" fw={candidate.blessingCode === slot.blessingCode ? 700 : undefined}>
                  {blessingLabel(candidate.blessingCode)}
                </Text>
                <Group gap="sm" wrap="nowrap">
                  <Text span fz="xs" c="dimmed">{formatValueRange(candidate.valueDistribution)}</Text>
                  <Text span fz="xs" fw={600} c="crimson.4" w={44} ta="right">
                    {formatPercent(candidate.probability)}
                  </Text>
                </Group>
              </Group>
            ))}
            {hidden > 0 && (
              <UnstyledButton onClick={() => setExpanded(true)}>
                <Text span c="dimmed" fz="xs" td="underline">
                  {strings.common.moreCount(hidden)}
                </Text>
              </UnstyledButton>
            )}
          </Stack>
        </Tooltip>
      )}
    </Stack>
  );
}

function SlotRow({ slot, resolved }: { slot: PreviewSlot, resolved?: EnhancementSlotOutcome }) {
  switch (slot.kind) {
    case 'EMPTY':
      return <EmptyRow slot={slot} />;
    case 'BLESSING':
      return <BlessingRow slot={slot} resolved={resolved} />;
    case 'WISH':
      return <WishRow slot={slot} resolved={resolved} />;
  }
}

/**
 * The piece drawn the way the game's item screen draws it — name tinted by
 * grade, its category glyph in its rank colour, the stars, the level, and the
 * four blessing slots — from the form state alone, so it redraws on every
 * keystroke and lets the player check their transcription against the screen
 * in front of them.
 *
 * Two faces of the same card ({@link PreviewFace}). HAVE is solid: every row
 * is a fact. WANT is a wish, and says so — dashed pills, "≥" floors, "Any"
 * where nothing was asked — because a card that looked as settled as the
 * left one would read as a promise of what the player will get.
 *
 * Only original art, as everywhere: the layout echoes the item screen, the
 * icons are ours.
 */
export function PieceCard({
  face,
  item,
  quality,
  level,
  slots,
  outcome,
}: PieceCardProps) {
  const strings = useStrings();
  const want = face === PreviewFace.WANT;
  const { icon: Icon, color, className } = getEquipmentIcon(item);
  const title = want ? strings.enhancement.previewWantTitle : strings.enhancement.previewHaveTitle;

  // Recessed like the Junk Oracle's query summary: a fill darker than the panel
  // reads as an inset well rather than a second panel competing with the result.
  return (
    <Paper
      radius="md"
      p="sm"
      withBorder
      bg="var(--mantine-color-dark-8)"
      style={want ? { borderStyle: 'dashed' } : undefined}
    >
      <Stack gap="xs">
        <Text fz="xs" c="dimmed" tt="uppercase" fw={600}>{title}</Text>

        <Group gap="xs" wrap="nowrap" align="flex-start">
          <Icon
            size={SUBJECT_ICON_SIZE}
            color={color ?? 'var(--mantine-color-dimmed)'}
            className={className}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <Text fw={600} style={{ ...gradeTextStyle([previewGrade(slots)]), minWidth: 0 }}>
            {item.displayName}
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <QualityStarRow value={quality} />
          <Divider orientation="vertical" />
          <Text span fw={600} fz="sm">{`+${level}`}</Text>
        </Group>

        <Divider />

        <Stack gap={6}>
          {slots.map((slot) => (
            <SlotRow
              key={slot.slot}
              slot={slot}
              resolved={outcome?.find((candidate) => candidate.slot === slot.slot)}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
