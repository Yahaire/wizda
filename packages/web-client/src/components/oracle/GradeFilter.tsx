'use client';

import { GRADE_HEX } from '@/components/gear/gearDisplays';
import { ColorSwatch, Group, Text } from '@mantine/core';
import { GRADES } from '@shared/domain/grade';

import { AndUp, AnyLevel, LevelSlider } from './LevelSlider';
import { clampLevel, gradeFloorFor, gradeName, MAX_LEVEL, MIN_LEVEL } from './oracle.logic';

interface GradeLevelProps {
  /** The stored minimum. {@link MIN_LEVEL} (White) accepts any. */
  value: number,
  /** Best grade the selected equipment can drop. */
  max: number,
  /** Blessings demanded of the piece — each needs a slot, which floors the grade. */
  blessingCount: number,
}

interface GradeFilterProps extends GradeLevelProps {
  onChange: (value: number) => void,
}

/**
 * What a grade buys you, which is the one thing its swatch can't say: the blessing
 * slots it activates. The readout above already names the colour, so the drag label
 * needn't repeat it.
 */
function slotsTooltip(activeBlessingSlots: number): string {
  let tooltipString: string;
  switch (activeBlessingSlots) {
    case 0: {
      tooltipString = "Any amount of blessings";
      break;
    }
    case 1: {
      tooltipString = "At least 1 blessing";
      break;
    }
    case 4: {
      tooltipString = "4 blessings";
      break;
    }
    default: {
      tooltipString = `At least ${activeBlessingSlots} blessings`;
      break;
    }
  }

  return tooltipString;
}

/** White is near-white: without a border it dissolves into the track. */
function GradeSwatch({ value, size }: { value: number, size: number }) {
  return (
    <ColorSwatch
      color={GRADE_HEX[value]!}
      size={size}
      withShadow={false}
      style={{ border: '1px solid var(--mantine-color-default-border)' }}
    />
  );
}

/** The grade the player settled for, named and painted the way the game names it. */
export function GradeReadout({ value, max, blessingCount }: GradeLevelProps) {
  const shown = clampLevel(value, gradeFloorFor(blessingCount), max);
  if (shown <= MIN_LEVEL) {
    return <AnyLevel />;
  }
  return (
    <Group gap={6} wrap="nowrap" component="span">
      <GradeSwatch value={shown} size={12} />
      <Text span fz="sm" fw={500} c={GRADE_HEX[shown]}>{gradeName(shown)}</Text>
      {shown < MAX_LEVEL && <AndUp />}
    </Group>
  );
}

/**
 * The grade axis as a floor. The game identifies a grade by its colour, so the
 * thumb takes the colour of the grade settled on — while the track stays the house
 * crimson every other control uses, since a track that changed colour under the
 * thumb would read as a second, louder control.
 *
 * Its lower bound comes from the blessings: a piece needs one active slot per
 * blessing, so demanding four of them means only Red will ever do. Asking for a
 * grade below that floor isn't wrong, just moot, so the slider states the floor
 * instead of arguing with it.
 */
export function GradeFilter({
  value,
  onChange,
  max,
  blessingCount,
}: GradeFilterProps) {
  const floor = gradeFloorFor(blessingCount);
  const shown = clampLevel(value, floor, max);

  return (
    <LevelSlider
      value={shown}
      onChange={onChange}
      min={floor}
      max={max}
      color="crimson"
      thumbColor={GRADE_HEX[shown]!}
      ariaLabel="Lowest acceptable grade"
      note={undefined}
      marks={GRADES.map((grade) => ({
        value: grade.value,
        label: <GradeSwatch value={grade.value} size={12} />,
        tooltip: slotsTooltip(grade.activeBlessingSlots),
      }))}
    />
  );
}
