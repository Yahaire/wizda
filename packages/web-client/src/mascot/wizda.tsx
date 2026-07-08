'use client';

import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

/**
 * Wizda's voice. For this release the mascot is expressed through microcopy +
 * emoji placeholders (real art/avatar comes later) — so keep every player-facing
 * message flowing through here, styled with the shared `.wizda-speech` look.
 */

/** Emoji placeholders standing in for the mascot until real art lands. */
export const WizdaEmoji = {
  welcome: '✨',
  confirm: '😮',
  snark: '😩',
  info: 'ℹ️',
  greet: '🧚',
} as const;

/** Shown once, ever, on a visitor's first arrival. */
export const WIZDA_WELCOME = "Welcome! I'm Wizda — Hope I can help you on your adventure.";

/** Playful, Wizardry-lore-flavoured lines — one per day on first open. */
export const WIZDA_GREETINGS: readonly string[] = [
  "Back for more delving? Let's find your treasure.",
  "The abyss runs deep today — good thing I do the math so you don't have to.",
  "Another day, another pile of junk to sort. Let's get you that gear.",
  "May your pulls be blessed and your grades be red.",
  "Welcome back, adventurer. Agora's watching — but I'm the one with the numbers.",
  "Ready to reverse some junk? I've got the odds.",
  "A wise delver farms smart, not hard. That's where I come in.",
  "New day, fresh luck. Let's see what you're hunting.",
];

export function pickGreeting(): string {
  const index = Math.floor(Math.random() * WIZDA_GREETINGS.length);
  return WIZDA_GREETINGS[index] ?? WIZDA_GREETINGS[0]!;
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
    confirmLabel = 'Tidy up',
    dismissLabel = 'Leave it',
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
