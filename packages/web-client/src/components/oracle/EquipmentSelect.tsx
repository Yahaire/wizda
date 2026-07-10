'use client';

import { EQUIPMENT_TIERS } from '@shared/domain/tier';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

import { getCategoryIcon, getEquipmentType } from '@/components/CategoryIcon';
import { getTierColor } from '@/components/gear/gearDisplays';
import { IconMultiSelect } from '@/components/select/IconMultiSelect';

interface EquipmentSelectProps {
  data: EquipmentListItem[],
  value: string[],
  onChange: (value: string[]) => void,
  /** Equipment names that still fit the category/tier picks. */
  available: ReadonlySet<string>,
  disabled?: boolean,
}

/** Tier kind → display name, for the dropdown's tier group headers. */
const TIER_NAME = new Map(EQUIPMENT_TIERS.map((tier) => [tier.kind, tier.name]));

const UNKNOWN_TIER_GROUP = 'Unknown tier';
// Highest tier first — the most sought-after gear should surface at the top.
const TIER_GROUP_ORDER = [
  ...[...EQUIPMENT_TIERS].reverse().map((tier) => tier.name),
  UNKNOWN_TIER_GROUP,
];

/** Max matches shown per tier group, so a broad search doesn't bury one tier under another. */
const OPTIONS_PER_TIER = 15;

/**
 * Multi-select equipment picker: matches loosely (see {@link IconMultiSelect}),
 * tints each item's icon by its tier, and groups dropdown options by tier.
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
        icon: getCategoryIcon(getEquipmentType(item.category?.code)),
        color: getTierColor(item.tier),
      })}
      isUnavailable={(item) => !available.has(item.name)}
      unavailableHint="Greyed out: doesn't fit your category or tier picks."
      grouping={{
        getGroup: (item) => (item.tier ? TIER_NAME.get(item.tier)! : UNKNOWN_TIER_GROUP),
        order: TIER_GROUP_ORDER,
        cap: OPTIONS_PER_TIER,
      }}
      placeholder="Search equipment"
      selectedPlaceholder="Add more gear…"
      emptyMessage="No gear by that name"
    />
  );
}
