'use client';

import { Chip, SimpleGrid } from '@mantine/core';

export interface LevelOption {
  value: number,
  label: React.ReactNode,
  disabled?: boolean,
}

interface LevelToggleGroupProps {
  options: LevelOption[],
  value: number[],
  onChange: (value: number[]) => void,
}

/**
 * A row of toggle chips for a small fixed set of levels (quality ★1–5, grade
 * White…Red). Laid out on a fixed 5-column grid so the quality row and the
 * grade row line up column-for-column. Incompatible options render greyed-out
 * (reactive disabling); the checkmark is suppressed to keep the chips compact.
 */
export function LevelToggleGroup({
  options,
  value,
  onChange,
}: LevelToggleGroupProps) {
  return (
    <Chip.Group
      multiple
      value={value.map(String)}
      onChange={(values) => onChange(values.map(Number))}
    >
      <SimpleGrid cols={5} spacing="xs" verticalSpacing="xs">
        {options.map((option) => {
          const isChecked = value.includes(option.value);
          return (
            <Chip
              key={option.value}
              value={String(option.value)}
              disabled={option.disabled}
              color="crimson"
              variant="outline"
              size="sm"
              styles={{
                root: {
                  width: '100%',
                  ...(option.disabled && { opacity: 0.4 }),
                },
                label: {
                  width: '100%',
                  justifyContent: 'center',
                  paddingInline: 4,
                  ...(isChecked && {
                    borderWidth: '2px',
                  }),
                },
                iconWrapper: { display: 'none' },
              }}
            >
              {option.label}
            </Chip>
          );
        })}
      </SimpleGrid>
    </Chip.Group>
  );
}
