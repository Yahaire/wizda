'use client';

import { Badge, ColorSwatch, Group, Text } from '@mantine/core';
import { GRADES } from '@shared/domain/grade';
import { EQUIPMENT_TIERS } from '@shared/domain/tier';
import { IconStarFilled } from '@tabler/icons-react';

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
  1: '#efe8da',
  2: '#61954a',
  3: '#58a2e6',
  4: '#b17ad6',
  5: '#e8492f',
};

export function gradeName(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return GRADES.find((grade) => grade.value === value)?.name.substring(0, 3) ?? `Grade ${value}`;
}

/**
 * Quality shown as a number + one star icon ("5★"), rather than five repeated
 * stars — compact, fits a narrow column, and side-steps the unintuitive
 * official "s5" notation (a Japanese mistranslation of 星五つ).
 */
export function QualityStars({ value, size = 12 }: { value: number, size?: number }) {
  return (
    <Group gap={2} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      <Text span fw={600} fz="sm">{value}</Text>
      <IconStarFilled size={size} />
    </Group>
  );
}

/**
 * Quality drawn the way the game draws it — `value` filled stars. Only worth it
 * when a single level is being shown (see the query summary); past that, counting
 * glyphs is slower than reading {@link QualityStars}' "4★".
 */
export function QualityStarRow({ value, size = 13 }: { value: number, size?: number }) {
  return (
    <Group gap={1} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      {Array.from({ length: value }, (_unused, index) => (
        <IconStarFilled key={index} size={size} />
      ))}
    </Group>
  );
}

export function GradeBadge({ value }: { value: number }) {
  const name = gradeName(value);
  return name
    ? <Badge variant="light" color={GRADE_COLORS[value]} size="sm">{name}</Badge>
    : null;
}

const TIER_BY_KIND = new Map(EQUIPMENT_TIERS.map((tier) => [tier.kind as string, tier]));

/** A tier's in-game tint, or undefined for an unknown/absent tier. */
export function getTierColor(kind?: string | null): string | undefined {
  return kind ? TIER_BY_KIND.get(kind)?.color : undefined;
}

/**
 * A small colour dot for an equipment tier, tinted to its in-game colour. Many
 * tiers are gray/near-white, so it carries a theme-aware border to stay visible
 * on any background.
 */
export function TierSwatch({ kind, size = 12 }: { kind: string, size?: number }) {
  const tier = TIER_BY_KIND.get(kind);
  if (!tier) {
    return null;
  }
  return (
    <ColorSwatch
      color={tier.color}
      size={size}
      withShadow={false}
      style={{ border: '1px solid var(--mantine-color-default-border)' }}
    />
  );
}

/** Tier as a swatch + name ("● Ebonsteel"). Null for an unknown/absent tier. */
export function TierBadge({ kind }: { kind: string | null | undefined }) {
  const tier = kind ? TIER_BY_KIND.get(kind) : undefined;
  if (!tier) {
    return null;
  }
  return (
    <Group gap={6} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      <TierSwatch kind={tier.kind} size={12} />
      <Text span fz="sm">{tier.name}</Text>
    </Group>
  );
}
