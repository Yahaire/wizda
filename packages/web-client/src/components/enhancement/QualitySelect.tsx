'use client';

import { IconSingleSelect } from '@/components/select/IconSingleSelect';
import { useStrings } from '@/i18n/LanguageProvider';
import { QUALITIES } from '@shared/domain/quality';

import type { QualityInfo } from '@shared/domain/quality';

interface QualitySelectProps {
  /** The piece's exact quality, 1-5 — unlike `QualityFilter`'s "this and up" floor semantics. */
  value: number | null,
  onChange: (value: number) => void,
  disabled?: boolean,
}

const getQualityValue = (quality: QualityInfo) => String(quality.value);
const getQualityLabel = (quality: QualityInfo) => quality.label;

/**
 * Exact-value ★1-5 dropdown for the piece's own quality, distinct from the Junk
 * Oracle's `QualityFilter` (a "this and up" floor). A dropdown rather than a
 * `SegmentedControl` because five segments don't fit `PieceForm`'s two-column
 * grid; `QualityPicker` still covers the compact inline case in `SlotEditor`'s
 * refinement sub-panel, where they do.
 *
 * No icon: `QualityInfo.label` is already the repeated-star string the item
 * screen shows, so a leading star glyph would just repeat it.
 */
export function QualitySelect({ value, onChange, disabled }: QualitySelectProps) {
  const strings = useStrings();

  return (
    <IconSingleSelect
      data={QUALITIES}
      value={value !== null ? String(value) : null}
      onChange={(next) => onChange(Number(next))}
      getValue={getQualityValue}
      getLabel={getQualityLabel}
      disabled={disabled}
      placeholder={strings.enhancement.qualitySelectPlaceholder}
      emptyMessage={strings.enhancement.noMatchesLabel}
      ariaLabel={strings.enhancement.qualityLabel}
    />
  );
}
