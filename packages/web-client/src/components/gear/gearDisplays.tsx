'use client';

import {
  Badge,
  Group,
  Text,
} from '@mantine/core';
import { IconStarFilled } from '@tabler/icons-react';

import { GRADES } from '@shared/domain/grade';

/** In-game grade colours (White…Red) as Mantine palette names, for badges. */
export const GRADE_COLORS: Record<number, string> = {
  1: 'gray',
  2: 'green',
  3: 'blue',
  4: 'grape',
  5: 'red',
};

/** In-game grade colours as concrete hex, for swatches. */
export const GRADE_HEX: Record<number, string> = {
  1: '#e8e2d6',
  2: '#4caf50',
  3: '#3b82f6',
  4: '#9b59b6',
  5: '#e02a2d',
};

export function gradeName(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return GRADES.find((grade) => grade.value === value)?.name ?? `Grade ${value}`;
}

/**
 * Quality shown as a number + one star icon ("5★"), rather than five repeated
 * stars — compact, fits a narrow column, and side-steps the unintuitive
 * official "s5" notation (a Japanese mistranslation of 星五つ).
 */
export function QualityStars({ value, size = 12 }: { value: number, size?: number }) {
  return (
    <Group gap={2} wrap="nowrap" c="yellow.4" component="span" style={{ display: 'inline-flex' }}>
      <Text span fw={600} fz="sm">{value}</Text>
      <IconStarFilled size={size} />
    </Group>
  );
}

export function GradeBadge({ value }: { value: number }) {
  const name = gradeName(value);
  return name
    ? <Badge variant="light" color={GRADE_COLORS[value]} size="sm">{name}</Badge>
    : null;
}
