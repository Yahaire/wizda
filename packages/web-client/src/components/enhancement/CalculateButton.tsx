'use client';

import { useStrings } from '@/i18n/LanguageProvider';
import { Button, Text } from '@mantine/core';
import { IconWand } from '@tabler/icons-react';

import { CalculateBlockerKind } from './enhancement.logic';

import type { UiStrings } from '@/i18n/strings';
import type { CalculateBlocker } from './enhancement.logic';

interface CalculateButtonProps {
  blockers: readonly CalculateBlocker[],
  /** Whether a blocked press has happened — only then does the button say why. */
  explain: boolean,
  loading: boolean,
  onCalculate: () => void,
  /** A press while anything is still missing. */
  onBlocked: () => void,
}

function blockerMessage(blocker: CalculateBlocker, strings: UiStrings): string {
  const messages = strings.enhancement.calculateBlocked;
  switch (blocker.kind) {
    case CalculateBlockerKind.PIECE_INCOMPLETE:
      return messages.pieceIncomplete;
    case CalculateBlockerKind.SLOT_BLESSING:
      return messages.slotBlessing(blocker.slot!);
    case CalculateBlockerKind.SLOT_VALUE:
      return messages.slotValue(blocker.slot!);
    case CalculateBlockerKind.NO_WISH:
      return messages.noWish;
    case CalculateBlockerKind.REFINE_ANSWER:
      return messages.refineAnswer(blocker.slot!);
    case CalculateBlockerKind.REFINE_UNSUPPORTED:
      return messages.refineUnsupported(blocker.slot!);
    case CalculateBlockerKind.REFINE_STONE:
      return messages.refineStone(blocker.slot!);
    case CalculateBlockerKind.SLOT_SHAPE:
      return messages.slotShape;
    case CalculateBlockerKind.NO_MILESTONE_AHEAD:
      return messages.noMilestoneAhead;
  }
}

/**
 * Calculate, and — once it's been pressed too early — the first thing it is
 * still waiting on.
 *
 * Never truly `disabled`: a disabled button swallows the click, and the click
 * is the moment to explain. It only *looks* disabled (`.wizda-blocked-button`)
 * and says so to assistive tech with `aria-disabled`, which also keeps it
 * reachable by keyboard so that explanation is there for everyone.
 *
 * The message names only the first blocker — the one the page focuses — and
 * counts the rest, which the slots mark in place.
 */
export function CalculateButton({
  blockers,
  explain,
  loading,
  onCalculate,
  onBlocked,
}: CalculateButtonProps) {
  const strings = useStrings();
  const [first] = blockers;
  const blocked = first !== undefined;

  const message = (() => {
    if (!explain || !blocked) {
      return null;
    }
    const lead = blockerMessage(first, strings);
    return blockers.length > 1
      ? strings.enhancement.calculateBlocked.withMore(lead, blockers.length - 1)
      : lead;
  })();

  return (
    <div>
      <Button
        size="md"
        fullWidth
        color="crimson"
        loading={loading}
        className={blocked ? 'wizda-blocked-button' : undefined}
        aria-disabled={blocked}
        leftSection={<IconWand size={18} />}
        onClick={blocked ? onBlocked : onCalculate}
      >
        {strings.enhancement.calculateButton}
      </Button>

      {/* Mounted even while empty, so the first message is announced as a change. */}
      <div role="status">
        {message && <Text size="sm" c="orange.6" ta="center" mt="xs">{message}</Text>}
      </div>
    </div>
  );
}
