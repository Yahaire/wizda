'use client';

import { EQUIPMENT_CATEGORIES, EQUIPMENT_TYPES } from '@shared/domain/equipment';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { IconMultiSelect } from '@/components/select/IconMultiSelect';

interface CategoryFilterProps {
  value: string[],
  onChange: (value: string[]) => void,
}

/** Equipment type kind → display name, for the dropdown's group headers/order. */
const TYPE_NAME = new Map(EQUIPMENT_TYPES.map((type) => [type.kind, type.name]));
const TYPE_GROUP_ORDER = EQUIPMENT_TYPES.map((type) => type.name);

/**
 * A searchable multi-select of equipment categories, grouped by equipment type.
 * An OR set — every selected category is accepted. Small enough (32 options) for
 * no per-group cap, unlike the huge equipment list.
 */
export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <IconMultiSelect
      data={EQUIPMENT_CATEGORIES}
      value={value}
      onChange={onChange}
      getValue={(category) => category.code}
      getLabel={(category) => category.name}
      getIcon={(category) => ({ icon: getCategoryIcon(category.equipmentType) })}
      grouping={{
        getGroup: (category) => TYPE_NAME.get(category.equipmentType)!,
        order: TYPE_GROUP_ORDER,
      }}
      placeholder="Any category"
      selectedPlaceholder="Add more categories…"
      emptyMessage="No matching category"
    />
  );
}
