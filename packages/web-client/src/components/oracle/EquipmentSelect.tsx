'use client';

import { useCallback, useMemo } from 'react';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { getRankColor, rankName } from '@/components/gear/gearDisplays';
import { IconMultiSelect } from '@/components/select/IconMultiSelect';
import { useStrings } from '@/i18n/LanguageProvider';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

interface EquipmentSelectProps {
  data: EquipmentListItem[],
  value: string[],
  onChange: (value: string[]) => void,
  /** Equipment names that still fit the category/rank picks. */
  available: ReadonlySet<string>,
  disabled?: boolean,
}

// Highest rank first — the most sought-after gear should surface at the top.
const RANKS_HIGH_TO_LOW = [...EQUIPMENT_RANKS].reverse();

// Module-level, not an inline arrow: a fresh identity every render would rebuild
// the dropdown's whole row model (738 items) on renders that changed nothing.
const getEquipmentValue = (item: EquipmentListItem) => item.name;

/**
 * Multi-select equipment picker: matches loosely (see {@link IconMultiSelect}),
 * tints each item's icon by its rank, and groups dropdown options by rank.
 */
export function EquipmentSelect({
  data,
  value,
  onChange,
  available,
  disabled,
}: EquipmentSelectProps) {
  const strings = useStrings();
  const unknownRankGroup = strings.oracle.unknownRankGroup;

  // Stable identities so IconMultiSelect's folded-text cache survives re-renders —
  // this is the one select big enough (the whole equipment catalogue) for that to
  // matter. A language switch re-pulls the list, so `data` changes identity and
  // the cache rebuilds with the new display names.
  const getLabel = useCallback((item: EquipmentListItem) => item.displayName, []);
  const getSearchTexts = useCallback(
    (item: EquipmentListItem) => [item.displayName, item.nameReading],
    [],
  );
  const getRankGroup = useCallback(
    (item: EquipmentListItem) => (item.rank ? rankName(item.rank) : unknownRankGroup),
    [unknownRankGroup],
  );
  // Memoized (not just recomputed inline) so the whole catalogue isn't
  // re-bucketed into groups on every render — this is the one select big enough
  // for that to show. Re-localizes on language switch via `unknownRankGroup`.
  const rankGroupOrder = useMemo(
    () => [
      ...RANKS_HIGH_TO_LOW.map((rank) => rankName(rank.kind)),
      unknownRankGroup,
    ],
    [unknownRankGroup],
  );

  return (
    <IconMultiSelect
      data={data}
      value={value}
      onChange={onChange}
      disabled={disabled}
      getValue={getEquipmentValue}
      // The stable English key stays the option's `value`; the localized display
      // name is what the player reads and searches — plus, in Japanese, the
      // reading, so a kana query can reach a name written in kanji.
      getLabel={getLabel}
      getSearchTexts={getSearchTexts}
      getIcon={(item) => ({
        icon: getCategoryIcon(item.category?.code),
        color: getRankColor(item.rank),
        className: 'wizda-icon-outline',
      })}
      isUnavailable={(item) => !available.has(item.name)}
      unavailableHint={strings.oracle.equipmentGreyedHint}
      grouping={{
        getGroup: getRankGroup,
        order: rankGroupOrder,
      }}
      placeholder={strings.oracle.searchEquipmentPlaceholder}
      selectedPlaceholder={strings.oracle.addMoreGearPlaceholder}
      emptyMessage={strings.oracle.noGearByName}
    />
  );
}
