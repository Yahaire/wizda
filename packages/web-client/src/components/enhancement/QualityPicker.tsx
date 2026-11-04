'use client';

import { QualityStarRow } from '@/components/gear/gearDisplays';
import { SegmentedControl } from '@mantine/core';
import { QUALITIES } from '@shared/domain/quality';

import type { FieldMarks } from './missingFields';

interface QualityPickerProps {
  /** The piece's exact quality, 1-5 — unlike `QualityFilter`'s "this and up" floor semantics. */
  value: number | null,
  onChange: (value: number) => void,
  size?: 'xs' | 'sm' | 'md',
  ariaLabel: string,
  /** Lets a blocked Calculate find and mark this picker — see `missingFields.ts`. */
  marks?: FieldMarks,
}

/**
 * Exact-value ★1-5 picker, distinct from the Junk Oracle's `QualityFilter`
 * (a "this and up" floor). Used only for `SlotEditor.tsx`'s refinement
 * sub-panel now — a compact inline pick of a Refinement Stone's ★ where a
 * `SegmentedControl` fits fine. The piece's own quality uses `QualitySelect`
 * instead: that field sits in `PieceForm`'s two-column grid, too narrow for
 * five segments.
 */
export function QualityPicker({ value, onChange, size = 'sm', ariaLabel, marks }: QualityPickerProps) {
  return (
    <SegmentedControl
      {...marks}
      className="wizda-missing-ring"
      aria-label={ariaLabel}
      size={size}
      value={value !== null ? String(value) : ''}
      onChange={(next) => onChange(Number(next))}
      data={QUALITIES.map((quality) => ({
        value: String(quality.value),
        label: <QualityStarRow value={quality.value} size={12} />,
      }))}
    />
  );
}
