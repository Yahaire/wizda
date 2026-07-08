'use client';

import {
  IconDiamond,
  IconHelmet,
  IconShield,
  IconShirt,
  IconShoe,
  IconSquare,
  IconSword,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

import { GearTypeKind } from '@shared/domain/gear';

/**
 * Placeholder equipment-category icons. Recolourable (tabler icons take a
 * `color`/`stroke`), so we can later tint them by tier. Keyed by gear type for
 * now; a per-category map can slot in once the item→category mapping is seeded.
 * A neutral square stands in whenever the category/type is unknown — which,
 * until that backend mapping lands, is every piece.
 */
const GEAR_TYPE_ICONS: Record<GearTypeKind, ComponentType<IconProps>> = {
  [GearTypeKind.WEAPON]: IconSword,
  [GearTypeKind.SHIELD]: IconShield,
  [GearTypeKind.HELMET]: IconHelmet,
  [GearTypeKind.GLOVES]: IconShirt,
  [GearTypeKind.CHEST_ARMOR]: IconShirt,
  [GearTypeKind.BOOTS]: IconShoe,
  [GearTypeKind.ACCESSORY]: IconDiamond,
};

interface CategoryIconProps extends IconProps {
  gearType?: GearTypeKind | null,
}

export function CategoryIcon({ gearType, ...iconProps }: CategoryIconProps) {
  const Icon = gearType ? GEAR_TYPE_ICONS[gearType] : IconSquare;
  return <Icon {...iconProps} />;
}
