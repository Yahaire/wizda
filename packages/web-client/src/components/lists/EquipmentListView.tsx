'use client';

import { useEffect, useMemo, useState } from 'react';

import { CategoryIcon } from '@/components/CategoryIcon';
import { DetailProvider, useDetail } from '@/components/detail/DetailProvider';
import { getRankColor, GradeBadge, QualityStars, RankBadge } from '@/components/gear/gearDisplays';
import { Column, DataTable } from '@/components/table/DataTable';
import { TruncatedText } from '@/components/TruncatedText';
import { wizda } from '@/mascot/voice';
import { WizdaEmoji, wizdaSay } from '@/mascot/wizda';
import { Alert, Center, Group, Loader, Select, Stack, Text, Title } from '@mantine/core';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';
import { IconInfoCircle } from '@tabler/icons-react';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
const RANK_OPTIONS = [
  { value: '', label: 'All ranks' },
  ...[...EQUIPMENT_RANKS]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((rank) => ({ value: rank.kind as string, label: rank.name })),
];

/** Rank kind → strength order, for sorting the Rank column meaningfully. */
const RANK_ORDER = new Map(EQUIPMENT_RANKS.map((rank) => [rank.kind as string, rank.orderIndex]));

const columns: Column<EquipmentListItem>[] = [
  {
    key: 'name',
    header: 'Equipment',
    width: '2.4fr',
    minWidth: 200,
    sortValue: (row) => row.name.toLowerCase(),
    render: (row) => (
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        <CategoryIcon
          size={16}
          categoryCode={row.category?.code}
          color={getRankColor(row.rank) ?? 'var(--mantine-color-dimmed)'}
          style={{ flexShrink: 0 }}
        />
        <TruncatedText>{row.name}</TruncatedText>
      </Group>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    width: '1.4fr',
    minWidth: 130,
    sortValue: (row) => row.category?.name ?? '',
    render: (row) => (row.category
      ? <TruncatedText>{row.category.name}</TruncatedText>
      : <Text c="dimmed">—</Text>),
  },
  {
    key: 'rank',
    header: 'Rank',
    width: '1fr',
    minWidth: 110,
    // Sort by the rank's strength order, not the enum string, so it reads
    // Worn → Silver rather than alphabetically.
    sortValue: (row) => RANK_ORDER.get(row.rank ?? '') ?? -1,
    render: (row) => (row.rank
      ? <RankBadge kind={row.rank} />
      : <Text c="dimmed">—</Text>),
  },
  {
    key: 'quality',
    header: 'Max ★',
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
    header: 'Max grade',
    width: '110px',
    minWidth: 108,
    sortValue: (row) => row.maxDropGrade ?? 0,
    render: (row) => (row.maxDropGrade
      ? <GradeBadge value={row.maxDropGrade} />
      : <Text c="dimmed">—</Text>),
  },
  {
    key: 'sources',
    header: 'Sources',
    width: '72px',
    minWidth: 68,
    align: 'right',
    sortValue: (row) => row.sources.length,
    render: (row) => <Text>{row.sources.length}</Text>,
  },
];

function EquipmentListContent() {
  const {
    equipment,
    status,
    maintenanceMessage,
    openEquipment,
  } = useDetail();
  const [rank, setRank] = useState<string>('');

  useEffect(() => {
    const visited = localStorage.getItem('equipment-list-visited');
    if (!visited) {
      wizdaSay(wizda.credits.thanks, {
        emoji: WizdaEmoji.welcome,
        autoClose: 12000,
      });
      localStorage.setItem('equipment-list-visited', 'true');
    }
  }, []);

  const filtered = useMemo(() => {
    if (!equipment) {
      return [];
    }
    return rank ? equipment.filter((item) => item.rank === rank) : equipment;
  }, [equipment, rank]);

  return (
    <Stack gap="md">
      <Title order={2}>Equipment</Title>

      {status === 'maintenance' && (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle />} title="Updating data">
          {maintenanceMessage}
        </Alert>
      )}
      {status === 'error' && (
        <Alert color="red" variant="light">Couldn&apos;t load the equipment list — try refreshing.</Alert>
      )}

      {status === 'loading' && (
        <Center mih={200}><Loader color="crimson" /></Center>
      )}

      {equipment && (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(row) => row.name}
          searchText={(row) => row.name}
          searchPlaceholder="Filter gear by name"
          emptyMessage="No gear matches those filters."
          onRowClick={(row) => openEquipment(row.name)}
          toolbar={(
            <Select
              data={RANK_OPTIONS}
              value={rank}
              onChange={(value) => setRank(value ?? '')}
              w={150}
              allowDeselect={false}
              aria-label="Filter by rank"
            />
          )}
        />
      )}
    </Stack>
  );
}

export function EquipmentListView() {
  return (
    <DetailProvider>
      <EquipmentListContent />
    </DetailProvider>
  );
}
