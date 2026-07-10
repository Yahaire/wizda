'use client';

import { useEffect, useMemo, useState } from 'react';

import { CategoryIcon } from '@/components/CategoryIcon';
import { DetailProvider, useDetail } from '@/components/detail/DetailProvider';
import { getTierColor, GradeBadge, QualityStars, TierBadge } from '@/components/gear/gearDisplays';
import { Column, DataTable } from '@/components/table/DataTable';
import { TruncatedText } from '@/components/TruncatedText';
import { WizdaEmoji, wizdaSay } from '@/mascot/wizda';
import { Alert, Center, Group, Loader, Select, Stack, Text, Title } from '@mantine/core';
import { EQUIPMENT_TIERS } from '@shared/domain/tier';
import { TsUtilities } from '@shared/tsUtilities';
import { IconInfoCircle } from '@tabler/icons-react';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
const TIER_OPTIONS = [
  { value: '', label: 'All tiers' },
  ...[...EQUIPMENT_TIERS]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((tier) => ({ value: tier.kind as string, label: tier.name })),
];

/** Tier kind → strength order, for sorting the Tier column meaningfully. */
const TIER_ORDER = new Map(EQUIPMENT_TIERS.map((tier) => [tier.kind as string, tier.orderIndex]));

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
          color={getTierColor(row.tier) ?? 'var(--mantine-color-dimmed)'}
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
    key: 'tier',
    header: 'Tier',
    width: '1fr',
    minWidth: 110,
    // Sort by the tier's strength order, not the enum string, so it reads
    // Worn → Silver rather than alphabetically.
    sortValue: (row) => TIER_ORDER.get(row.tier ?? '') ?? -1,
    render: (row) => (row.tier
      ? <TierBadge kind={row.tier} />
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
  const [tier, setTier] = useState<string>('');

  useEffect(() => {
    const visited = localStorage.getItem('equipment-list-visited');
    if (!visited) {
      wizdaSay(
        TsUtilities.stringJoin([
          'Special thanks to NRJank and the Fasterthoughts team for compiling and maintaining',
          'the gear lists — your work makes this possible!',
        ]),
        
        {
          emoji: WizdaEmoji.welcome,
          autoClose: 12000,
        }
      );
      localStorage.setItem('equipment-list-visited', 'true');
    }
  }, []);

  const filtered = useMemo(() => {
    if (!equipment) {
      return [];
    }
    return tier ? equipment.filter((item) => item.tier === tier) : equipment;
  }, [equipment, tier]);

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
              data={TIER_OPTIONS}
              value={tier}
              onChange={(value) => setTier(value ?? '')}
              w={150}
              allowDeselect={false}
              aria-label="Filter by tier"
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
