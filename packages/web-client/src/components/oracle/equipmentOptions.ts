'use client';

import { useMemo } from 'react';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { getRankColor, rankName } from '@/components/gear/gearDisplays';
import { useStrings } from '@/i18n/LanguageProvider';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';

import type { SelectGrouping, SelectOptionIcon } from '@/components/select/selectOptions';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

/**
 * How a piece of equipment presents itself in a select — shared by
 * `EquipmentSelect` (the Junk Oracle's multi-select) and
 * `EquipmentSingleSelect` (the Enhancement Oracle's one-piece picker), so the
 * two can never drift into showing the same catalogue two different ways.
 *
 * Every function here is module-level rather than defined per render: this is
 * the one catalogue big enough (738 items) that a fresh identity would rebuild
 * the dropdown's row model — and re-fold every item's search text — on renders
 * that changed nothing.
 */

// Highest rank first — the most sought-after gear should surface at the top.
const RANKS_HIGH_TO_LOW = [...EQUIPMENT_RANKS].reverse();

/** The stable English key, not the localized name — this is the option's identity. */
export const getEquipmentValue = (item: EquipmentListItem) => item.name;

/** The localized name, which is what the player reads. */
export const getEquipmentLabel = (item: EquipmentListItem) => item.displayName;

/**
 * The localized name plus, in Japanese, the reading the API sends alongside it,
 * so a kana query can reach a name written in kanji.
 */
export const getEquipmentSearchTexts = (item: EquipmentListItem) => [
  item.displayName,
  item.nameReading,
];

/** The piece's category glyph, tinted to its rank. */
export const getEquipmentIcon = (item: EquipmentListItem): SelectOptionIcon => ({
  icon: getCategoryIcon(item.category?.code),
  color: getRankColor(item.rank),
  className: 'wizda-icon-outline',
});

/**
 * Groups dropdown options by rank, best first, with an "unknown rank" bucket
 * last. Memoized on the language rather than on nothing: `rankName` resolves
 * through the module-level string store, so the language is the one input that
 * changes its answer.
 */
export function useEquipmentRankGrouping(): SelectGrouping<EquipmentListItem> {
  const unknownRankGroup = useStrings().oracle.unknownRankGroup;

  return useMemo(
    () => ({
      getGroup: (item: EquipmentListItem) => (item.rank ? rankName(item.rank) : unknownRankGroup),
      order: [
        ...RANKS_HIGH_TO_LOW.map((rank) => rankName(rank.kind)),
        unknownRankGroup,
      ],
    }),
    [unknownRankGroup],
  );
}
