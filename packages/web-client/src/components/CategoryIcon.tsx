'use client';

import { EQUIPMENT_CATEGORIES, EquipmentTypeKind } from '@shared/domain/equipment';
import {
    IconBrandRedhat, IconCircle, IconHandStop, IconProps, IconQuestionMark, IconShield, IconShirt,
    IconShoe, IconSword
} from '@tabler/icons-react';

import type { ComponentType } from 'react';

/**
 * Placeholder equipment-category icons. Recolourable (tabler icons take a
 * `color`/`stroke`), so we can tint them by tier. Keyed by equipment type for
 * now; a per-category map can slot in later. A question mark stands in whenever
 * the category/type is unknown — a neutral shape read as a failed render.
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

/** The icon component for an equipment type, or a question mark when unknown. */
export function getCategoryIcon(equipmentType?: EquipmentTypeKind | null): ComponentType<IconProps> {
  return equipmentType ? EQUIPMENT_TYPE_ICONS[equipmentType] : IconQuestionMark;
}

/** Category code → its equipment type, so a code alone is enough to pick an icon. */
const EQUIPMENT_TYPE_BY_CATEGORY = new Map(
  EQUIPMENT_CATEGORIES.map((category) => [category.code, category.equipmentType]),
);

/** The equipment type a category belongs to, or null for an unknown/absent code. */
export function getEquipmentType(categoryCode?: string | null): EquipmentTypeKind | null {
  return categoryCode ? EQUIPMENT_TYPE_BY_CATEGORY.get(categoryCode) ?? null : null;
}

interface CategoryIconProps extends IconProps {
  equipmentType?: EquipmentTypeKind | null,
}

export function CategoryIcon({ equipmentType, ...iconProps }: CategoryIconProps) {
  const Icon = getCategoryIcon(equipmentType);
  return <Icon {...iconProps} />;
}
