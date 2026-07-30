'use client';

import { useCallback, useMemo } from 'react';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { categoryName, equipmentTypeName } from '@/components/gear/gearDisplays';
import { IconMultiSelect } from '@/components/select/IconMultiSelect';
import { useLang, useStrings } from '@/i18n/LanguageProvider';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_TYPES } from '@shared/domain/equipment';

import type { EquipmentCategoryInfo } from '@shared/domain/equipment';

interface CategoryFilterProps {
  value: string[],
  onChange: (value: string[]) => void,
  /**
   * Category codes any junk-droppable piece belongs to — see
   * `OracleFacets.catalogCategory`. The rest never reach the menu.
   */
  offered: ReadonlySet<string>,
  /** Category codes some candidate still has, given the equipment/rank picks. */
  available: ReadonlySet<string>,
}

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
  const strings = useStrings();
  const data = useMemo(
    () => EQUIPMENT_CATEGORIES.filter(
      (category) => offered.has(category.code) || value.includes(category.code),
    ),
    [offered, value],
  );
  // Stable identities so the dropdown's row model isn't rebuilt every render.
  // Keyed on the language rather than on nothing: `equipmentTypeName` resolves
  // through the module-level string store, so the language is the one input that
  // changes its answer — and the one thing these have to re-run for.
  // `lang` looks unused to the linter because the dependency runs through
  // `getStrings()` inside `equipmentTypeName`, not through a captured variable.
  const lang = useLang();
  const getTypeGroup = useCallback(
    (category: EquipmentCategoryInfo) => equipmentTypeName(category.equipmentType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  );
  const typeGroupOrder = useMemo(
    () => EQUIPMENT_TYPES.map((type) => equipmentTypeName(type.kind)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  );

  return (
    <IconMultiSelect
      data={data}
      value={value}
      onChange={onChange}
      getValue={(category) => category.code}
      getLabel={(category) => categoryName(category.code)}
      getIcon={(category) => ({ icon: getCategoryIcon(category.code) })}
      isUnavailable={(category) => !available.has(category.code)}
      unavailableHint={strings.oracle.categoryGreyedHint}
      grouping={{
        getGroup: getTypeGroup,
        order: typeGroupOrder,
      }}
      placeholder={strings.oracle.anyCategoryPlaceholder}
      selectedPlaceholder={strings.oracle.addMoreCategoriesPlaceholder}
      emptyMessage={strings.oracle.noMatchingCategory}
    />
  );
}
