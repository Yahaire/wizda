'use client';

import { FieldSwap } from '@/components/oracle/FieldSwap';
import { IconSingleSelect } from '@/components/select/IconSingleSelect';
import { useStrings } from '@/i18n/LanguageProvider';
import { Slider } from '@mantine/core';

import { MAX_ENHANCEMENT_LEVEL, targetLevelOptions } from './enhancement.logic';

interface TargetLevelFieldProps {
  value: number,
  onChange: (value: number) => void,
  /**
   * Where the piece is now. Both the floor of the offered levels and the
   * "leave it where it is" option itself — see `targetLevelOptions`.
   */
  currentLevel: number,
  ariaLabel: string,
}

interface TargetOption {
  value: string,
  label: string,
}

const getOptionValue = (option: TargetOption) => option.value;
const getOptionLabel = (option: TargetOption) => option.label;

/**
 * How far the player plans to take the piece: the milestones still ahead of it,
 * plus staying put.
 *
 * Unlike {@link CurrentLevelField} this asks for an **intention**, not a fact,
 * and the intermediate levels are ones no player benefits from choosing —
 * `targetLevelOptions` has the derivation. Steering the choice toward the levels
 * that differ is the point of the field, not a rounding of the player's answer.
 *
 * A dropdown past the swap rather than a `SegmentedControl`, so it matches the
 * two fields above it (`QualitySelect`, `GradeSelect`) in the same grid — five
 * segments and a dropdown side by side in one form would read as two different
 * kinds of question.
 */
export function TargetLevelField({ value, onChange, currentLevel, ariaLabel }: TargetLevelFieldProps) {
  const strings = useStrings();
  const levels = targetLevelOptions(currentLevel);
  const options: TargetOption[] = levels.map((level) => ({
    value: String(level),
    label: `+${level}`,
  }));

  return (
    <FieldSwap
      full={(
        <Slider
          aria-label={ariaLabel}
          color="crimson"
          min={currentLevel}
          max={MAX_ENHANCEMENT_LEVEL}
          // The offered levels are the only stops, so the track can't land
          // between them and the marks double as the whole scale.
          restrictToMarks
          marks={levels.map((level) => ({ value: level, label: `+${level}` }))}
          value={value}
          onChange={onChange}
          label={(level) => `+${level}`}
        />
      )}
      compact={(
        <IconSingleSelect
          data={options}
          value={String(value)}
          onChange={(next) => onChange(Number(next))}
          getValue={getOptionValue}
          getLabel={getOptionLabel}
          emptyMessage={strings.enhancement.noMatchesLabel}
          ariaLabel={ariaLabel}
        />
      )}
    />
  );
}
