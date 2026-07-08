'use client';

import {
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Badge,
  Center,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
import { GEAR_TIERS } from '@shared/domain/tier';

import {
  Column,
  DataTable,
} from '@/components/table/DataTable';
import {
  DetailProvider,
  useDetail,
} from '@/components/detail/DetailProvider';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TruncatedText } from '@/components/TruncatedText';
import {
  GradeBadge,
  QualityStars,
} from '@/components/gear/gearDisplays';

const TIER_OPTIONS = [
  { value: '', label: 'All tiers' },
  ...GEAR_TIERS.map((tier) => ({ value: tier.kind as string, label: tier.name })),
];

const columns: Column<EquipmentListItem>[] = [
  {
    key: 'name',
    header: 'Equipment',
    width: '2.4fr',
    minWidth: 200,
    sortValue: (row) => row.name.toLowerCase(),
    render: (row) => (
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        {/* Neutral placeholder until the item→category mapping is seeded. */}
        <CategoryIcon size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        <TruncatedText>{row.name}</TruncatedText>
      </Group>
    ),
  },
  {
    key: 'tier',
    header: 'Tier',
    width: '1fr',
    minWidth: 110,
    sortValue: (row) => row.tier ?? '',
    render: (row) => (row.tier
      ? <Badge variant="light" color="gray" size="sm">{row.tier}</Badge>
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
          searchText={(row) => row.name.toLowerCase()}
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
