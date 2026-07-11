'use client';

import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { wizda } from './voice';

/**
 * Wizda's render helpers. Her *words* live in the phrase catalog (`voice.ts` /
 * `voice.en.ts`); this file only turns them into toasts. For this release the
 * mascot is expressed through microcopy + emoji placeholders (real art/avatar
 * comes later) — so keep every player-facing message flowing through here,
 * styled with the shared `.wizda-speech` look.
 */

/** Emoji placeholders standing in for the mascot until real art lands. */
export const WizdaEmoji = {
  welcome: '✨',
  confirm: '😮',
  snark: '😩',
  info: 'ℹ️',
  greet: '🧚',
} as const;

export function pickGreeting(): string {
  const daily = wizda.greet.daily;
  const index = Math.floor(Math.random() * daily.length);
  return daily[index] ?? daily[0]!;
}

/** A line Wizda "says", rendered in her speech style. */
function speech(emoji: string, text: string) {
  return (
    <Text component="span" className="wizda-speech">
      {emoji} {text}
    </Text>
  );
}

interface WizdaSayOptions {
  emoji?: string,
  color?: string,
  autoClose?: number | false,
}

/** Show a passing message from Wizda (auto-dismissing, bottom-anchored toast). */
export function wizdaSay(text: string, options: WizdaSayOptions = {}): void {
  const { emoji = WizdaEmoji.welcome, color, autoClose } = options;
  notifications.show({
    message: speech(emoji, text),
    color,
    withBorder: true,
    ...(autoClose !== undefined ? { autoClose } : {}),
  });
}

interface WizdaConfirmOptions {
  emoji?: string,
  confirmLabel?: string,
  dismissLabel?: string,
}

/**
 * A cleanup confirm from Wizda — a non-blocking toast with an action button,
 * on every screen size. `onConfirm` runs the tidy-up; dismiss just closes it.
 */
export function wizdaConfirm(
  text: string,
  onConfirm: () => void,
  options: WizdaConfirmOptions = {},
): void {
  const {
    emoji = WizdaEmoji.confirm,
    confirmLabel = wizda.confirm.tidyLabel,
    dismissLabel = wizda.confirm.leaveLabel,
  } = options;

  const id = `wizda-confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  notifications.show({
    id,
    autoClose: false,
    withCloseButton: true,
    withBorder: true,
    message: (
      <Stack gap="xs">
        {speech(emoji, text)}
        <Group gap="xs" justify="flex-end">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => notifications.hide(id)}
          >
            {dismissLabel}
          </Button>
          <Button
            size="xs"
            color="crimson"
            onClick={() => {
              onConfirm();
              notifications.hide(id);
            }}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    ),
  });
}
