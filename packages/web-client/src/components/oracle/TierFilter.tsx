'use client';

import { IconMultiSelect } from '@/components/select/IconMultiSelect';
import { EQUIPMENT_TIERS } from '@shared/domain/tier';
import { IconCircleFilled } from '@tabler/icons-react';

interface TierFilterProps {
  value: string[],
  onChange: (value: string[]) => void,
  /** Tier kinds some candidate still has, given the equipment/category picks. */
  available: ReadonlySet<string>,
}

// Only tiers that actually drop from junk are worth offering, ordered highest
// (most sought-after) first.
const TIER_CHOICES = [...EQUIPMENT_TIERS]
  .filter((tier) => tier.isObtainableThroughJunk)
  .sort((left, right) => right.orderIndex - left.orderIndex);

/**
 * A searchable multi-select of equipment tiers. An OR set — every selected
 * tier is accepted. Small enough (5 options) to skip grouping, unlike
 * {@link CategoryFilter}/{@link EquipmentSelect}.
 */
export function TierFilter({ value, onChange, available }: TierFilterProps) {
  return (
    <IconMultiSelect
      data={TIER_CHOICES}
      value={value}
      onChange={onChange}
      getValue={(tier) => tier.kind}
      getLabel={(tier) => tier.name}
      getIcon={(tier) => ({ icon: IconCircleFilled, color: tier.color })}
      isUnavailable={(tier) => !available.has(tier.kind)}
      unavailableHint="Greyed out: no gear you've picked comes in that tier."
      placeholder="Any tier"
      selectedPlaceholder="Add more tiers…"
      emptyMessage="No matching tier"
    />
  );
}
