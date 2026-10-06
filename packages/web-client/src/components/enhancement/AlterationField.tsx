'use client';

import { useStrings } from '@/i18n/LanguageProvider';
import { Group, Select, Stack, Switch } from '@mantine/core';

import {
    allBlessingOptions, alterableSlots, NOT_SURE, SlotFormState, SlotShape
} from './enhancement.logic';

interface AlterationFieldProps {
  alteredSlot: number | null,
  alteredFrom: string | null,
  slots: Record<number, SlotFormState>,
  shape: SlotShape,
  onChange: (patch: { alteredSlot: number | null, alteredFrom: string | null }) => void,
}

/**
 * The single piece-level "this piece has been altered" declaration — not a
 * per-slot flag, since at most one slot on a piece is ever altered (every
 * stone that grants a fresh alteration first wipes the previous one, see
 * `docs/stones.md`). Declaring it, and which slot, is a correctness input:
 * omitting it silently zeroes out a real duplicate-blessing probability — see
 * `docs/calculation/enhancement.md`, "Duplicate blessings".
 */
export function AlterationField({
  alteredSlot,
  alteredFrom,
  slots,
  shape,
  onChange,
}: AlterationFieldProps) {
  const strings = useStrings();
  const candidates = alterableSlots(slots, shape);

  const setDeclared = (declared: boolean) => {
    onChange(declared
      ? { alteredSlot: candidates[0] ?? null, alteredFrom: null }
      : { alteredSlot: null, alteredFrom: null });
  };

  return (
    <Stack gap="xs">
      <Switch
        size="sm"
        label={strings.enhancement.alterationToggleLabel}
        checked={alteredSlot !== null}
        disabled={candidates.length === 0}
        onChange={(event) => setDeclared(event.currentTarget.checked)}
      />

      {alteredSlot !== null && (
        <Group gap="md" wrap="wrap" pl="md">
          <Select
            label={strings.enhancement.alteredSlotLabel}
            size="sm"
            data={candidates.map((slot) => ({ value: String(slot), label: strings.enhancement.slotLabel(slot) }))}
            value={String(alteredSlot)}
            onChange={(next) => onChange({ alteredSlot: next ? Number(next) : null, alteredFrom })}
            allowDeselect={false}
          />
          <Select
            label={strings.enhancement.originalBlessingLabel}
            size="sm"
            data={[{ value: NOT_SURE, label: strings.enhancement.notSure }, ...allBlessingOptions()]}
            value={alteredFrom ?? NOT_SURE}
            onChange={(next) => onChange({
              alteredSlot,
              alteredFrom: (!next || next === NOT_SURE) ? null : next,
            })}
            searchable
            allowDeselect={false}
          />
        </Group>
      )}
    </Stack>
  );
}
