'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { CategoryIcon } from '@/components/CategoryIcon';
import { useDetail } from '@/components/detail/DetailProvider';
import {
    categoryName, getRankColor, GradeBadge, QualityStars, RankBadge, rankName
} from '@/components/gear/gearDisplays';
import { PageTitle } from '@/components/PageTitle';
import { Column, DataTable } from '@/components/table/DataTable';
import { TruncatedText } from '@/components/TruncatedText';
import { useSearchQueryParam } from '@/hooks/useSearchQueryParam';
import { useLang, useStrings, useWizda } from '@/i18n/LanguageProvider';
import { WizdaGlyph, wizdaSay } from '@/mascot/wizda';
import { Alert, Center, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';
import { IconQuestionMark, IconWorld } from '@tabler/icons-react';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

/** Rank kind → strength order, for sorting the Rank column meaningfully. */
const RANK_ORDER = new Map(EQUIPMENT_RANKS.map((rank) => [rank.kind as string, rank.orderIndex]));

/**
 * Cell for a category/rank we don't have. The bare em-dash this replaces read as
 * "this piece has none", when the truth is "we haven't classified it yet" — the
 * case for gear the game ships before the taxonomy source catches up. The `?`
 * glyph is the same one `getCategoryIcon` falls back to, so an unclassified piece
 * looks the same here as it does in its row icon and in the Oracle's picker.
 */
function UnknownValue({ label }: { label: string }) {
  return (
    <Group gap={6} wrap="nowrap" c="dimmed" style={{ minWidth: 0 }}>
      <IconQuestionMark size={14} style={{ flexShrink: 0 }} />
      <TruncatedText>{label}</TruncatedText>
    </Group>
  );
}

function EquipmentListContent() {
  const strings = useStrings();
  const wizda = useWizda();
  const lang = useLang();
  const { initialQuery, syncQueryToUrl } = useSearchQueryParam();
  const {
    equipment,
    status,
    openEquipment,
  } = useDetail();
  const [rank, setRank] = useState<string>('');

  // Stable so DataTable's folded-text cache survives re-renders. `nameReading`
  // is present only in Japanese, and is what lets a kana query reach a kanji name.
  const equipmentSearchTexts = useCallback(
    (row: EquipmentListItem) => [row.displayName, row.nameReading],
    [],
  );

  const rankOptions = useMemo(() => [
    { value: '', label: strings.lists.allRanksOption },
    ...[...EQUIPMENT_RANKS]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((entry) => ({ value: entry.kind as string, label: rankName(entry.kind) })),
  ], [strings]);

  const columns: Column<EquipmentListItem>[] = [
    {
      key: 'name',
      header: strings.lists.columnEquipment,
      width: '2.4fr',
      minWidth: 200,
      sortValue: (row) => row.displayName.toLowerCase(),
      render: (row) => (
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <CategoryIcon
            size={16}
            categoryCode={row.category?.code}
            color={getRankColor(row.rank) ?? 'var(--mantine-color-dimmed)'}
            style={{ flexShrink: 0 }}
          />
          <TruncatedText>{row.displayName}</TruncatedText>
        </Group>
      ),
    },
    {
      key: 'category',
      header: strings.lists.columnCategory,
      width: '1.4fr',
      minWidth: 130,
      // Unclassified sorts last rather than first — an empty string would float a
      // block of "?" rows above the real categories on the default ascending sort.
      sortValue: (row) => (row.category ? categoryName(row.category.code) : '￿'),
      render: (row) => (row.category
        ? <TruncatedText>{categoryName(row.category.code)}</TruncatedText>
        : <UnknownValue label={strings.lists.uncategorisedLabel} />),
    },
    {
      key: 'rank',
      header: strings.lists.columnRank,
      width: '1fr',
      minWidth: 110,
      // Sort by the rank's strength order, not the enum string, so it reads
      // Worn → Silver rather than alphabetically.
      sortValue: (row) => RANK_ORDER.get(row.rank ?? '') ?? -1,
      render: (row) => (row.rank
        ? <RankBadge kind={row.rank} />
        : <UnknownValue label={strings.lists.uncategorisedLabel} />),
    },
    {
      key: 'quality',
      header: strings.lists.columnMaxQuality,
      width: '84px',
      minWidth: 80,
      align: 'right',
      sortValue: (row) => row.maxDropQuality ?? 0,
      render: (row) => (row.maxDropQuality
        ? <QualityStars value={row.maxDropQuality} />
        : <Text c="dimmed">—</Text>),
    },
    {
      key: 'grade',
      header: strings.lists.columnMaxGrade,
      width: '110px',
      minWidth: 108,
      sortValue: (row) => row.maxDropGrade ?? 0,
      render: (row) => (row.maxDropGrade
        ? <GradeBadge value={row.maxDropGrade} />
        : <Text c="dimmed">—</Text>),
    },
    {
      key: 'sources',
      header: strings.lists.columnSources,
      width: '72px',
      minWidth: 68,
      align: 'right',
      sortValue: (row) => row.sources.length,
      render: (row) => <Text>{row.sources.length}</Text>,
    },
  ];

  useEffect(() => {
    const visited = localStorage.getItem('equipment-list-visited');
    if (!visited) {
      wizdaSay(wizda.credits.thanks, {
        glyph: WizdaGlyph.welcome,
        autoClose: 12000,
      });
      localStorage.setItem('equipment-list-visited', 'true');
    }
  }, [wizda]);

  const filtered = useMemo(() => {
    if (!equipment) {
      return [];
    }
    return rank ? equipment.filter((item) => item.rank === rank) : equipment;
  }, [equipment, rank]);

  return (
    <Stack gap="md">
      <PageTitle shareable>{strings.lists.equipmentTitle}</PageTitle>

      {/* Only junk-dropping gear has localized names — everything else falls back
          to English (see the backend seed). Say so, but only when it matters. */}
      {lang !== 'en' && (
        <Alert color="gray" variant="light" icon={<IconWorld size={16} />}>
          {strings.notices.equipmentLocalizationCaveat}
        </Alert>
      )}

      {status === 'error' && (
        <Alert color="red" variant="light">{strings.lists.equipmentLoadError}</Alert>
      )}

      {status === 'loading' && (
        <Center mih={200}><Loader color="crimson" /></Center>
      )}

      {equipment && (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(row) => row.name}
          searchTexts={equipmentSearchTexts}
          searchPlaceholder={strings.lists.equipmentSearchPlaceholder}
          emptyMessage={strings.lists.equipmentEmptyMessage}
          onRowClick={(row) => openEquipment(row.name)}
          initialQuery={initialQuery}
          onQueryChange={syncQueryToUrl}
          toolbar={(
            <Select
              data={rankOptions}
              value={rank}
              onChange={(value) => setRank(value ?? '')}
              w={150}
              allowDeselect={false}
              aria-label={strings.lists.filterByRankAriaLabel}
            />
          )}
        />
      )}
    </Stack>
  );
}

/**
 * `useSearchQueryParam` reads `useSearchParams()`, which needs a `<Suspense>`
 * boundary above it in a statically prerendered route (or `next build` fails
 * with the CSR-bailout error) — this wrapper is that boundary.
 */
export function EquipmentListView() {
  return (
    <Suspense fallback={<Center mih={200}><Loader color="crimson" /></Center>}>
      <EquipmentListContent />
    </Suspense>
  );
}
