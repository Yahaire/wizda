'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { GiFairy, GiHyenaHead } from 'react-icons/gi';

import { gameIcon, IconComponent } from '@/components/icons/iconComponent';
import { Anchor, Box, Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconInfoCircle, IconSparkles } from '@tabler/icons-react';

import { wizda } from './voice';

/** Default lifetime for an auto-dismissing toast (matches the provider default). */
const DEFAULT_AUTO_CLOSE_MS = 5000;

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

interface WizdaToastBodyProps {
  id: string,
  glyph: IconComponent,
  text: React.ReactNode,
  /** Optional muted, smaller subtext under her line (plain register, not her voice). */
  note?: React.ReactNode,
  /** When set, the note carries a trailing ⓘ that links here (in-app route). */
  noteHref?: string,
  /** Auto-dismiss delay in ms, or null to stay until closed. */
  autoCloseMs: number | null,
}

/** Grace after leaving a toast whose deadline already elapsed — lets you move back in. */
const HOVER_LEAVE_GRACE_MS = 1500;

/**
 * Wizda's toast content, managing its own dismissal so hovering doesn't yank it
 * away mid-read (Mantine's built-in `autoClose` can't be suppressed on hover).
 * The original deadline is fixed at show-time and never moves — hovering only
 * *suppresses* the close while the pointer or keyboard focus is inside. On leave
 * we honour whatever time was left; if the deadline already passed we close after
 * a short grace, so a stray flick of the cursor doesn't lose the toast. Touch has
 * no hover, so the plain deadline is its behaviour.
 */
function WizdaToastBody({ id, glyph, text, note, noteHref, autoCloseMs }: WizdaToastBodyProps) {
  const timerRef = useRef<number | null>(null);
  const deadlineRef = useRef<number>(0);
  // Pointer and keyboard focus are independent "inside" channels: the toast only
  // closes once *both* have left, so tabbing to the ⓘ then moving the mouse away
  // (or vice-versa) doesn't dismiss it.
  const pointerInsideRef = useRef(false);
  const focusInsideRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const isInside = () => pointerInsideRef.current || focusInsideRef.current;

  // Close at the original deadline if time remains, otherwise after a short grace.
  const rescheduleFromDeadline = () => {
    if (autoCloseMs === null) {
      return;
    }
    clearTimer();
    const remaining = deadlineRef.current - Date.now();
    const delay = remaining > 0 ? remaining : HOVER_LEAVE_GRACE_MS;
    timerRef.current = window.setTimeout(() => notifications.hide(id), delay);
  };

  const handleEnter = (channel: 'pointer' | 'focus') => {
    if (channel === 'pointer') {
      pointerInsideRef.current = true;
    } else {
      focusInsideRef.current = true;
    }
    clearTimer(); // never close while the user is on it
  };

  const handleLeave = (channel: 'pointer' | 'focus') => {
    if (channel === 'pointer') {
      pointerInsideRef.current = false;
    } else {
      focusInsideRef.current = false;
    }
    if (isInside()) {
      return; // still held by the other channel
    }
    rescheduleFromDeadline();
  };

  useEffect(() => {
    if (autoCloseMs !== null) {
      deadlineRef.current = Date.now() + autoCloseMs;
      timerRef.current = window.setTimeout(() => notifications.hide(id), autoCloseMs);
    }
    // If the window loses focus while the pointer is still parked on the toast, no
    // mouseleave fires — treat a window blur as leaving so it doesn't hang open.
    const handleWindowBlur = () => {
      if (!isInside()) {
        return;
      }
      pointerInsideRef.current = false;
      focusInsideRef.current = false;
      rescheduleFromDeadline();
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      clearTimer();
      window.removeEventListener('blur', handleWindowBlur);
    };
    // Set up once on mount; ref-based handlers manage state without re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      onMouseEnter={() => handleEnter('pointer')}
      onMouseLeave={() => handleLeave('pointer')}
      onFocusCapture={() => handleEnter('focus')}
      onBlurCapture={() => handleLeave('focus')}
    >
      <Stack gap={4}>
        {speech(glyph, text)}
        {note && (
          <Group gap={6} wrap="nowrap" align="center">
            <Text size="xs" c="dimmed">{note}</Text>
            {noteHref && (
              <Anchor
                component={Link}
                href={noteHref}
                c="dimmed"
                aria-label="Where this data comes from"
                onClick={() => notifications.hide(id)}
                style={{ display: 'inline-flex', flexShrink: 0 }}
              >
                <IconInfoCircle size={14} />
              </Anchor>
            )}
          </Group>
        )}
      </Stack>
    </Box>
  );
}

interface WizdaSayOptions {
  glyph?: IconComponent,
  color?: string,
  autoClose?: number | false,
  /** Muted subtext under her line — plain, factual register (see the freshness toast). */
  note?: React.ReactNode,
  /** When set, the note gets a trailing ⓘ linking to this in-app route. */
  noteHref?: string,
}

/** Show a passing message from Wizda (hover-pausing, bottom-anchored toast). */
export function wizdaSay(text: string, options: WizdaSayOptions = {}): void {
  const {
    glyph = WizdaGlyph.welcome,
    color,
    autoClose,
    note,
    noteHref,
  } = options;

  const id = `wizda-say-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const autoCloseMs = autoClose === false ? null : (autoClose ?? DEFAULT_AUTO_CLOSE_MS);

  notifications.show({
    id,
    // We run the countdown ourselves (WizdaToastBody) so it can pause on
    // hover/focus; the close button is the manual fallback.
    autoClose: false,
    withCloseButton: true,
    color,
    withBorder: true,
    message: (
      <WizdaToastBody
        id={id}
        glyph={glyph}
        text={text}
        note={note}
        noteHref={noteHref}
        autoCloseMs={autoCloseMs}
      />
    ),
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
