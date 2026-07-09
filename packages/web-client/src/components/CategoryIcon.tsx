'use client';

import { EquipmentTypeKind } from '@shared/domain/equipment';
import {
    IconBrandRedhat, IconCircle, IconHandStop, IconProps, IconShield, IconShirt, IconShoe,
    IconSquare, IconSword
} from '@tabler/icons-react';

import type { ComponentType } from 'react';

/**
 * Placeholder equipment-category icons. Recolourable (tabler icons take a
 * `color`/`stroke`), so we can later tint them by tier. Keyed by equipment type
 * for now; a per-category map can slot in once the item→category mapping is
 * seeded. A neutral square stands in whenever the category/type is unknown —
 * which, until that backend mapping lands, is every piece.
 */
const EQUIPMENT_TYPE_ICONS: Record<EquipmentTypeKind, ComponentType<IconProps>> = {
  [EquipmentTypeKind.WEAPON]: IconSword,
  [EquipmentTypeKind.SHIELD]: IconShield,
  [EquipmentTypeKind.HELMET]: IconBrandRedhat,
  [EquipmentTypeKind.GLOVES]: IconHandStop,
  [EquipmentTypeKind.CHEST_ARMOR]: IconShirt,
  [EquipmentTypeKind.BOOTS]: IconShoe,
  [EquipmentTypeKind.ACCESSORY]: IconCircle,
};

interface CategoryIconProps extends IconProps {
  equipmentType?: EquipmentTypeKind | null,
}

export function CategoryIcon({ equipmentType, ...iconProps }: CategoryIconProps) {
  const Icon = equipmentType ? EQUIPMENT_TYPE_ICONS[equipmentType] : IconSquare;
  return <Icon {...iconProps} />;
}
