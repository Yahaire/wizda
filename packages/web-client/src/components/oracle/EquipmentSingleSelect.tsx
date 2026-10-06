'use client';

import { IconSingleSelect } from '@/components/select/IconSingleSelect';
import { useStrings } from '@/i18n/LanguageProvider';

import {
    getEquipmentIcon, getEquipmentLabel, getEquipmentSearchTexts, getEquipmentValue,
    useEquipmentRankGrouping
} from './equipmentOptions';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

interface EquipmentSingleSelectProps {
  data: EquipmentListItem[],
  /** The picked piece's English key, or null for nothing picked yet. */
  value: string | null,
  onChange: (value: string) => void,
  disabled?: boolean,
  ariaLabel?: string,
}

/**
 * One-piece equipment picker: the same catalogue and presentation as
 * {@link EquipmentSelect} (see `equipmentOptions`), with a target that shows the
 * chosen piece instead of holding it as a pill beside a search prompt.
 *
 * Searchable, unlike the Enhancement Oracle's other single-selects — 738 options
 * is well past what anyone will scroll.
 *
 * No `available` set: unlike the Junk Oracle's faceted filter panel, nothing
 * here narrows the catalogue, so no option is ever greyed out.
 */
export function EquipmentSingleSelect({
  data,
  value,
  onChange,
  disabled,
  ariaLabel,
}: EquipmentSingleSelectProps) {
  const strings = useStrings();
  const grouping = useEquipmentRankGrouping();

  return (
    <IconSingleSelect
      data={data}
      value={value}
      onChange={onChange}
      disabled={disabled}
      ariaLabel={ariaLabel}
      getValue={getEquipmentValue}
      getLabel={getEquipmentLabel}
      getSearchTexts={getEquipmentSearchTexts}
      getIcon={getEquipmentIcon}
      grouping={grouping}
      searchable
      searchPlaceholder={strings.oracle.searchEquipmentPlaceholder}
      placeholder={strings.enhancement.equipmentSelectPlaceholder}
      emptyMessage={strings.oracle.noGearByName}
    />
  );
}
