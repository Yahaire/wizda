'use client';

import { GiFairy, GiHyenaHead } from 'react-icons/gi';

import { gameIcon, IconComponent } from '@/components/icons/iconComponent';
import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconInfoCircle, IconSparkles } from '@tabler/icons-react';

import { wizda } from './voice';

/**
 * Wizda's render helpers. Her *words* live in the phrase catalog (`voice.ts` /
 * `voice.en.ts`); this file only turns them into toasts. She's marked with a
 * small crimson glyph per voice slot (see {@link WizdaGlyph}), rendered in the
 * shared `.wizda-speech` look — so keep every player-facing message flowing
 * through here.
 */

/**
 * Wizda's glyphs, one per voice slot, all painted her crimson. A sparkle where
 * she's simply talking, a fairy for her daily hello, a cackling hyena for a
 * tease, and meaningful marks where the glyph must carry sense — a caution
 * triangle for a cleanup prompt, the ⓘ info mark for help (the same glyph as
 * the filter ⓘ buttons). Tabler icons satisfy {@link IconComponent} directly;
 * game-icons go through the {@link gameIcon} fill adapter.
 */
export const WizdaGlyph = {
  welcome: IconSparkles,
  greet: gameIcon(GiFairy),
  snark: gameIcon(GiHyenaHead),
  confirm: IconAlertTriangle,
  info: IconInfoCircle,
} satisfies Record<string, IconComponent>;

/**
 * One of Wizda's glyphs, sized to ride inline as a leading mark before her words
 * (scales with the surrounding font-size). It inherits the *text* colour rather
 * than shouting in crimson: inline it's a supporting mark on her handwriting, so
 * it stays quiet. The saturated crimson is reserved for the standalone *display*
 * sparkles (the tagline / empty-results hero), which are focal and earn the pop.
 */
export function WizdaMark({ glyph: Glyph }: { glyph: IconComponent }) {
  return (
    <Glyph
      size="1em"
      color="currentColor"
      style={{
        // Centre the glyph on the text's x-height so it sits on the line rather
        // than dropping toward the descenders (as `text-bottom` did).
        verticalAlign: 'middle',
        marginRight: '0.35em',
        flexShrink: 0,
      }}
    />
  );
}

export function pickGreeting(): string {
  const daily = wizda.greet.daily;
  const index = Math.floor(Math.random() * daily.length);
  return daily[index] ?? daily[0]!;
}

/** A line Wizda "says", rendered in her speech style with a leading glyph. */
function speech(glyph: IconComponent, text: React.ReactNode) {
  return (
    <Text component="span" className="wizda-speech">
      <WizdaMark glyph={glyph} />
      {text}
    </Text>
  );
}

interface WizdaSayOptions {
  glyph?: IconComponent,
  color?: string,
  autoClose?: number | false,
}

/** Show a passing message from Wizda (auto-dismissing, bottom-anchored toast). */
export function wizdaSay(text: string, options: WizdaSayOptions = {}): void {
  const { glyph = WizdaGlyph.welcome, color, autoClose } = options;
  notifications.show({
    message: speech(glyph, text),
    color,
    withBorder: true,
    ...(autoClose !== undefined ? { autoClose } : {}),
  });
}

interface WizdaConfirmOptions {
  glyph?: IconComponent,
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
    glyph = WizdaGlyph.confirm,
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
        {speech(glyph, text)}
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
