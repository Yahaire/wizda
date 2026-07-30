'use client';

import { Badge, ColorSwatch, Group, Text } from '@mantine/core';
import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';
import { IconStarFilled } from '@tabler/icons-react';

import { getStrings } from '@/i18n/languageStore';

import type { EquipmentCategoryCode, EquipmentTypeKind } from '@shared/domain/equipment';
import type { EquipmentRankKind } from '@shared/domain/rank';

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
  // Abbreviated to keep the badge compact — a no-op for single-glyph names
  // (Japanese grade colours are one character).
  const name = getStrings().vocab.gradeName[value as 1 | 2 | 3 | 4 | 5];
  return name ? name.substring(0, 3) : `Grade ${value}`;
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

const RANK_BY_KIND = new Map(EQUIPMENT_RANKS.map((rank) => [rank.kind as string, rank]));

/** A rank's in-game tint, or undefined for an unknown/absent rank. */
export function getRankColor(kind?: string | null): string | undefined {
  return kind ? RANK_BY_KIND.get(kind)?.color : undefined;
}

/**
 * A small colour dot for an equipment rank, tinted to its in-game colour. Many
 * ranks are gray/near-white, so it carries a theme-aware border to stay visible
 * on any background.
 */
export function RankSwatch({ kind, size = 12 }: { kind: string, size?: number }) {
  const rank = RANK_BY_KIND.get(kind);
  if (!rank) {
    return null;
  }
  return (
    <ColorSwatch
      color={rank.color}
      size={size}
      withShadow={false}
      style={{ border: '1px solid var(--mantine-color-default-border)' }}
    />
  );
}

/** A rank's localized display name, falling back to its English name. */
export function rankName(kind: string): string {
  return getStrings().vocab.rankName[kind as EquipmentRankKind] ?? RANK_BY_KIND.get(kind)?.name ?? kind;
}

/** Rank as a swatch + name ("● Ebonsteel"). Null for an unknown/absent rank. */
export function RankBadge({ kind }: { kind: string | null | undefined }) {
  const rank = kind ? RANK_BY_KIND.get(kind) : undefined;
  if (!rank) {
    return null;
  }
  return (
    <Group gap={6} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      <RankSwatch kind={rank.kind} size={12} />
      <Text span fz="sm">{rankName(rank.kind)}</Text>
    </Group>
  );
}

const CATEGORY_NAME_BY_CODE = new Map(
  EQUIPMENT_CATEGORIES.map((category) => [category.code as string, category.name]),
);

/** A category's localized display name, falling back to its English name. */
export function categoryName(code: string | null | undefined): string {
  if (!code) {
    return '';
  }
  return (
    getStrings().vocab.categoryName[code as EquipmentCategoryCode]
    ?? CATEGORY_NAME_BY_CODE.get(code)
    ?? code
  );
}

/** An equipment type's localized group-header name (e.g. "Weapons"). */
export function equipmentTypeName(kind: EquipmentTypeKind): string {
  return getStrings().vocab.equipmentTypeName[kind] ?? kind;
}
