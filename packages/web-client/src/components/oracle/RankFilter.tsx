'use client';

import { IconMultiSelect } from '@/components/select/IconMultiSelect';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';
import { IconCircleFilled } from '@tabler/icons-react';

interface RankFilterProps {
  value: string[],
  onChange: (value: string[]) => void,
  /** Rank kinds some candidate still has, given the equipment/category picks. */
  available: ReadonlySet<string>,
}

// Only ranks that actually drop from junk are worth offering, ordered highest
// (most sought-after) first.
const RANK_CHOICES = [...EQUIPMENT_RANKS]
  .filter((rank) => rank.isObtainableThroughJunk)
  .sort((left, right) => right.orderIndex - left.orderIndex);

/**
 * A searchable multi-select of equipment ranks. An OR set — every selected
 * rank is accepted. Small enough (5 options) to skip grouping, unlike
 * {@link CategoryFilter}/{@link EquipmentSelect}.
 */
export function RankFilter({ value, onChange, available }: RankFilterProps) {
  return (
    <IconMultiSelect
      data={RANK_CHOICES}
      value={value}
      onChange={onChange}
      getValue={(rank) => rank.kind}
      getLabel={(rank) => rank.name}
      getIcon={(rank) => ({ icon: IconCircleFilled, color: rank.color })}
      isUnavailable={(rank) => !available.has(rank.kind)}
      unavailableHint="Greyed out: no gear you've picked comes in that rank."
      placeholder="Any rank"
      selectedPlaceholder="Add more ranks…"
      emptyMessage="No matching rank"
    />
  );
}
