'use client';

import { Box } from '@mantine/core';

/**
 * The breakpoint at which a form's fields stop owning a full row each and go
 * two-up. It drives both halves of that rearrangement — the `SimpleGrid`'s
 * column count and every {@link FieldSwap} sitting inside those columns — so the
 * layout and the controls can never disagree about where the change happens.
 */
export const COMPACT_FIELD_BREAKPOINT = 'sm';

interface FieldSwapProps {
  /** Drawn while the field has a whole row to itself. */
  full: React.ReactNode,
  /** Drawn once the field shares its row and has to fit half of it. */
  compact: React.ReactNode,
}

/**
 * Two renderings of one value, picked by how much room the field has rather
 * than by what kind of device is asking. A slider wants a full-width row — it
 * spends width on precision, and a milestone mark every few pixels is unusable
 * — while a number box or a dropdown says the same thing in a half-width
 * column and gains keyboard entry doing it.
 *
 * Both are mounted and CSS chooses, rather than a `useMediaQuery`: every page
 * here is statically prerendered, and a hook that reports `false` on the server
 * would flash the full-width control at everyone past the breakpoint until
 * hydration corrected it. `hiddenFrom`/`visibleFrom` resolve to `display: none`,
 * which also keeps the unused twin out of the tab order and the accessibility
 * tree — so one field never reads as two.
 */
export function FieldSwap({ full, compact }: FieldSwapProps) {
  return (
    <>
      <Box hiddenFrom={COMPACT_FIELD_BREAKPOINT}>{full}</Box>
      <Box visibleFrom={COMPACT_FIELD_BREAKPOINT}>{compact}</Box>
    </>
  );
}
