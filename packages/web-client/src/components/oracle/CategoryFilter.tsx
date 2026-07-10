'use client';

import { useMemo } from 'react';

import { EQUIPMENT_CATEGORIES, EQUIPMENT_TYPES } from '@shared/domain/equipment';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { IconMultiSelect } from '@/components/select/IconMultiSelect';

interface CategoryFilterProps {
  value: string[],
  onChange: (value: string[]) => void,
  /**
   * Category codes any junk-droppable piece belongs to — see
   * `OracleFacets.catalogCategory`. The rest never reach the menu.
   */
  offered: ReadonlySet<string>,
  /** Category codes some candidate still has, given the equipment/tier picks. */
  available: ReadonlySet<string>,
}

/** Equipment type kind → display name, for the dropdown's group headers/order. */
const TYPE_NAME = new Map(EQUIPMENT_TYPES.map((type) => [type.kind, type.name]));
const TYPE_GROUP_ORDER = EQUIPMENT_TYPES.map((type) => type.name);

/**
 * A searchable multi-select of equipment categories, grouped by equipment type.
 * An OR set — every selected category is accepted. Small enough (~32 options) for
 * no per-group cap, unlike the huge equipment list.
 *
 * A category no junk drops is left off the menu entirely rather than greyed out
 * (Tools, at the time of writing): greying out answers "not with your other picks",
 * which would be a lie about a category that has nothing to pick in the first place.
 * A pick that is *still* selected survives regardless, so a remembered selection
 * from before the data changed can always be taken back.
 */
export function CategoryFilter({
  value,
  onChange,
  offered,
  available,
}: CategoryFilterProps) {
  const data = useMemo(
    () => EQUIPMENT_CATEGORIES.filter(
      (category) => offered.has(category.code) || value.includes(category.code),
    ),
    [offered, value],
  );

  return (
    <IconMultiSelect
      data={data}
      value={value}
      onChange={onChange}
      getValue={(category) => category.code}
      getLabel={(category) => category.name}
      getIcon={(category) => ({ icon: getCategoryIcon(category.equipmentType) })}
      isUnavailable={(category) => !available.has(category.code)}
      unavailableHint="Greyed out: no gear you've picked is that kind."
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
