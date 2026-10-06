'use client';

import { IconMultiSelect } from '@/components/select/IconMultiSelect';
import { useStrings } from '@/i18n/LanguageProvider';

import {
    getEquipmentIcon, getEquipmentLabel, getEquipmentSearchTexts, getEquipmentValue,
    useEquipmentRankGrouping
} from './equipmentOptions';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

interface EquipmentSelectProps {
  data: EquipmentListItem[],
  value: string[],
  onChange: (value: string[]) => void,
  /** Equipment names that still fit the category/rank picks. */
  available: ReadonlySet<string>,
  disabled?: boolean,
}

/**
 * Multi-select equipment picker: matches loosely (see {@link IconMultiSelect}),
 * tints each item's icon by its rank, and groups dropdown options by rank. For
 * a field that keeps exactly one piece, use `EquipmentSingleSelect` — same
 * catalogue and presentation (see `equipmentOptions`), single-value target.
 */
export function EquipmentSelect({
  data,
  value,
  onChange,
  available,
  disabled,
}: EquipmentSelectProps) {
  const strings = useStrings();
  const grouping = useEquipmentRankGrouping();

  return (
    <IconMultiSelect
      data={data}
      value={value}
      onChange={onChange}
      disabled={disabled}
      getValue={getEquipmentValue}
      getLabel={getEquipmentLabel}
      getSearchTexts={getEquipmentSearchTexts}
      getIcon={getEquipmentIcon}
      isUnavailable={(item) => !available.has(item.name)}
      unavailableHint={strings.oracle.equipmentGreyedHint}
      grouping={grouping}
      placeholder={strings.oracle.searchEquipmentPlaceholder}
      selectedPlaceholder={strings.oracle.addMoreGearPlaceholder}
      emptyMessage={strings.oracle.noGearByName}
    />
  );
}
