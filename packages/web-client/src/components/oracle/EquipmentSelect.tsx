'use client';

import { EQUIPMENT_RANKS } from '@shared/domain/rank';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { getRankColor } from '@/components/gear/gearDisplays';
import { IconMultiSelect } from '@/components/select/IconMultiSelect';

interface EquipmentSelectProps {
  data: EquipmentListItem[],
  value: string[],
  onChange: (value: string[]) => void,
  /** Equipment names that still fit the category/rank picks. */
  available: ReadonlySet<string>,
  disabled?: boolean,
}

/** Rank kind → display name, for the dropdown's rank group headers. */
const RANK_NAME = new Map(EQUIPMENT_RANKS.map((rank) => [rank.kind, rank.name]));

const UNKNOWN_RANK_GROUP = 'Unknown rank';
// Highest rank first — the most sought-after gear should surface at the top.
const RANK_GROUP_ORDER = [
  ...[...EQUIPMENT_RANKS].reverse().map((rank) => rank.name),
  UNKNOWN_RANK_GROUP,
];

/** Max matches shown per rank group, so a broad search doesn't bury one rank under another. */
const OPTIONS_PER_RANK = 15;

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
  return (
    <IconMultiSelect
      data={data}
      value={value}
      onChange={onChange}
      disabled={disabled}
      getValue={(item) => item.name}
      getLabel={(item) => item.name}
      getIcon={(item) => ({
        icon: getCategoryIcon(item.category?.code),
        color: getRankColor(item.rank),
        className: 'wizda-icon-outline',
      })}
      isUnavailable={(item) => !available.has(item.name)}
      unavailableHint="Greyed out: doesn't fit your category or rank picks."
      grouping={{
        getGroup: (item) => (item.rank ? RANK_NAME.get(item.rank)! : UNKNOWN_RANK_GROUP),
        order: RANK_GROUP_ORDER,
        cap: OPTIONS_PER_RANK,
      }}
      placeholder="Search equipment"
      selectedPlaceholder="Add more gear…"
      emptyMessage="No gear by that name"
    />
  );
}
