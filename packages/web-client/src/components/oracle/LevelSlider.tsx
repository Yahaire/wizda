'use client';

import { Slider, Stack, Text } from '@mantine/core';

/** One stop on the scale: what to draw under the track, and what to call it. */
export interface LevelMark {
  value: number,
  /** Drawn under the track. Keep it narrow — the stops sit close together. */
  label: React.ReactNode,
  /**
   * What the drag label shows at this stop. Free to spend itself on whatever the
   * mark can't show — the mark is a swatch or a row of stars, after all — so long as
   * it stays shorter than the track.
   */
  tooltip: React.ReactNode,
}

interface LevelSliderProps {
  marks: LevelMark[],
  /** The level to show. Already clamped into `[min, max]` by the caller. */
  value: number,
  onChange: (value: number) => void,
  /** Lowest selectable level — below it, every drop already qualifies anyway. */
  min: number,
  /** Highest selectable level — above it, nothing drops. */
  max: number,
  /** Track colour. The house crimson, unless an axis has a better idea. */
  color: string,
  /** Thumb colour, when the picked level has a colour of its own. Defaults to `color`. */
  thumbColor?: string,
  ariaLabel: string,
  /** Dimmed note under the track, explaining a bound the rest of the query imposed. */
  note?: string,
}

/** The lowest level constrains nothing, so it says so rather than "1★ and up". */
export function AnyLevel() {
  return <Text c="dimmed" fz="sm">Any</Text>;
}

/** "…and everything above". Dropped at the top of the scale, where there is nothing above. */
export function AndUp() {
  return <Text span c="dimmed" fz="sm" fw={700}>+</Text>;
}

/**
 * A "this level and everything above it" picker for the two ordered axes
 * (quality ★1–5, grade White…Red). A player almost never wants *only* 3★ — they
 * want the best odds of anything they'd accept — so each axis is a threshold
 * rather than a set, and its lowest level therefore means "any".
 *
 * The bounds carry the filter interdependency. `max` is a wall: the selected gear
 * cannot drop above it, so a stored value past it is a real contradiction (the
 * caller raises the conflict prompt). `min` is only a floor the rest of the query
 * already imposes — a value below it *means* the floor — so we render the floor and
 * leave the stored value be, and it returns intact once the floor lifts. When the
 * two meet, there is nothing left to choose and the track goes away entirely —
 * the field's readout already states the level it settled on.
 */
export function LevelSlider({
  marks,
  value,
  onChange,
  min,
  max,
  color,
  thumbColor,
  ariaLabel,
  note,
}: LevelSliderProps) {
  const caption = note && <Text c="dimmed" fz="xs" mt={6}>{note}</Text>;

  if (min >= max) {
    return caption ?? null;
  }

  // Mantine centres the drag label on the thumb and has no collision handling of
  // its own (it is a bare absolute div, not a Floating UI tooltip). On a track this
  // short a wordy label would then hang off the panel at either end, so we slide it
  // along with the thumb: flush left at the bottom of the scale, flush right at the
  // top, centred in between. Whatever it says now fits, at every stop.
  const travel = (value - min) / (max - min);

  return (
    <Stack gap={0}>
      <Slider
        aria-label={ariaLabel}
        color={color}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={onChange}
        // Paint everything the filter accepts, which for a minimum is the track to
        // the *right* of the thumb. Filling leftward would say the opposite of what
        // the axis means at both ends: nothing painted at "Any" (where every drop
        // qualifies) and a full track at 5★ (where almost none do).
        inverted
        marks={marks.filter((mark) => mark.value >= min && mark.value <= max)}
        label={(level) => marks.find((mark) => mark.value === level)?.tooltip ?? level}
        // Mark labels hang below the track without reserving any space of their own.
        mb={22}
        styles={{
          markLabel: { whiteSpace: 'nowrap' },
          label: { transform: `translateX(${(0.5 - travel) * 100}%)` },
          ...(thumbColor && { thumb: { borderColor: thumbColor } }),
        }}
      />
      {caption}
    </Stack>
  );
}
