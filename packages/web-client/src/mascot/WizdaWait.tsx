'use client';

import { Box, Stack, Text } from '@mantine/core';

import type { IconComponent } from '@/components/icons/iconComponent';

/**
 * Which of Wizda's two waiting animations to play. `float` is the gentle idle
 * hover held while the wait is on; `rise` is the one-shot grow-into-place for
 * the moment it ends. Both degrade to a motionless glyph under
 * `prefers-reduced-motion` — see the keyframes in `globals.css`.
 */
export type WizdaWaitAnimation = 'float' | 'rise';

interface WizdaWaitProps {
  /** One of {@link WizdaGlyph}'s marks, drawn large and crimson. */
  glyph: IconComponent,
  /** Her line, in her speech style, beneath the mark. */
  line: string,
  animation?: WizdaWaitAnimation,
  /** Glyph size in px — the full-screen takeover goes large, an in-page veil smaller. */
  size?: number,
}

/**
 * Wizda asking you to hold on: her mark, animated, with a line under it.
 *
 * The motif is deliberately shared rather than re-cut per caller — the
 * full-screen "she's stepped out" takeover (`MaintenanceGate`) and the in-page
 * "still filling in" scrim (`PreparingVeil`) are the same beat to a player, and
 * should look it. What's *not* shared is the container: one is a fixed, opaque
 * page takeover and the other an absolute, translucent panel over a single
 * block, so each owns its own backdrop and positioning and this owns only what
 * they have in common.
 *
 * Keyed on the animation so switching between the two restarts the new one
 * rather than adopting the outgoing one's progress mid-flight.
 */
export function WizdaWait({
  glyph: Glyph,
  line,
  animation = 'float',
  size = 96,
}: WizdaWaitProps) {
  return (
    <Stack align="center" gap="md" maw={420} px="md">
      <Box
        key={animation}
        className={`wizda-${animation} wizda-icon-outline`}
        style={{ display: 'flex' }}
      >
        <Glyph size={size} color="var(--mantine-color-crimson-5)" />
      </Box>
      <Text className="wizda-speech" ta="center">
        {line}
      </Text>
    </Stack>
  );
}
