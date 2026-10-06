'use client';

import { FieldSwap } from '@/components/oracle/FieldSwap';
import { useSelectOnFocus } from '@/hooks/useSelectOnFocus';
import { NumberInput, Slider } from '@mantine/core';

import { MAX_ENHANCEMENT_LEVEL, MILESTONE_LEVELS, MIN_ENHANCEMENT_LEVEL } from './enhancement.logic';

interface CurrentLevelFieldProps {
  value: number,
  onChange: (value: number) => void,
  ariaLabel: string,
}

const MARKS = MILESTONE_LEVELS.map((milestone) => ({ value: milestone, label: `+${milestone}` }));

/**
 * Where the piece is right now: every level +0…+20, one at a time.
 *
 * Step 1 even though the odds only read this level through `floor(level / 5)` —
 * a +11 and a +14 piece compute identically. This field asks the player to state
 * a **fact they can read off the item screen**, and a tool that answers "+14"
 * with "+10" looks like it misread the piece it is about to reason over. The
 * sister field, {@link TargetLevelField}, asks for an intention instead, and is
 * free to offer only the choices that differ.
 *
 * The milestone marks stay on the slider because they are where the value the
 * player is asking about actually moves (`docs/milestone-blessings.md`); past
 * the swap the number box drops them, and the target field's own list — nothing
 * but milestones — carries that lesson instead.
 */
export function CurrentLevelField({ value, onChange, ariaLabel }: CurrentLevelFieldProps) {
  const { ref: numberRef, selectOnFocus } = useSelectOnFocus<HTMLInputElement>();

  return (
    <FieldSwap
      full={(
        <Slider
          aria-label={ariaLabel}
          color="crimson"
          min={MIN_ENHANCEMENT_LEVEL}
          max={MAX_ENHANCEMENT_LEVEL}
          step={1}
          value={value}
          onChange={onChange}
          marks={MARKS}
          label={(level) => `+${level}`}
        />
      )}
      compact={(
        <NumberInput
          ref={numberRef}
          aria-label={ariaLabel}
          value={value}
          // An emptied box reads as +0 rather than as nothing: the level always
          // has a real value, and `clampBehavior` has no opinion on `''`.
          onChange={(next) => onChange(Number(next) || MIN_ENHANCEMENT_LEVEL)}
          onFocus={selectOnFocus}
          min={MIN_ENHANCEMENT_LEVEL}
          max={MAX_ENHANCEMENT_LEVEL}
          step={1}
          clampBehavior="strict"
          allowDecimal={false}
          allowNegative={false}
          prefix="+"
        />
      )}
    />
  );
}
