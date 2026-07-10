'use client';

import { QualityStarRow, QualityStars } from '@/components/gear/gearDisplays';
import { Group } from '@mantine/core';
import { QUALITIES } from '@shared/domain/quality';

import { AndUp, AnyLevel, LevelSlider } from './LevelSlider';
import { clampLevel, MAX_LEVEL, MIN_LEVEL } from './oracle.logic';

interface QualityLevelProps {
  /** The stored minimum. {@link MIN_LEVEL} accepts any. */
  value: number,
  /** Best star count the selected equipment can drop. Unbounded by default. */
  max?: number,
}

interface QualityFilterProps extends QualityLevelProps {
  onChange: (value: number) => void,
  max: number,
}

/** Small enough that five of them fit under one stop of the track. */
const MARK_STAR_SIZE = 8;

/**
 * The quality the player settled for, said compactly ("3★+") — the track already
 * writes the stars out, and counting glyphs is slower than reading a number.
 */
export function QualityReadout({ value, max = MAX_LEVEL }: QualityLevelProps) {
  const shown = clampLevel(value, MIN_LEVEL, max);
  if (shown <= MIN_LEVEL) {
    return <AnyLevel />;
  }
  return (
    <Group gap={2} wrap="nowrap" component="span">
      <QualityStars value={shown} />
      {shown < MAX_LEVEL && <AndUp />}
    </Group>
  );
}

/**
 * The quality axis as a floor, its stops drawn in the game's own currency: the
 * written stars a piece carries.
 */
export function QualityFilter({ value, onChange, max }: QualityFilterProps) {
  return (
    <LevelSlider
      value={clampLevel(value, MIN_LEVEL, max)}
      onChange={onChange}
      min={MIN_LEVEL}
      max={max}
      color="crimson"
      ariaLabel="Lowest acceptable quality"
      // The stop already writes the stars out, so the drag label says the same thing
      // the field's readout does — what picking this stop would leave the field saying.
      marks={QUALITIES.map((quality) => ({
        value: quality.value,
        label: <QualityStarRow value={quality.value} size={MARK_STAR_SIZE} />,
        tooltip: <QualityReadout value={quality.value} />,
      }))}
    />
  );
}
