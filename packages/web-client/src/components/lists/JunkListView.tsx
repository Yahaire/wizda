'use client';

import { useMemo } from 'react';

import {
  Alert,
  Badge,
  Center,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import type {
  EquipmentListItem,
  JunkListItem,
} from '@shared/api/endpoints/lists.models';

import {
  Column,
  DataTable,
} from '@/components/table/DataTable';
import {
  DetailProvider,
  useDetail,
} from '@/components/detail/DetailProvider';
import { TruncatedText } from '@/components/TruncatedText';
import {
  GradeBadge,
  QualityStars,
} from '@/components/gear/gearDisplays';

interface JunkRow extends JunkListItem {
  drops: number,
}

function JunkListContent() {
  const {
    junks,
    dropsByJunk,
    status,
    maintenanceMessage,
    openJunk,
  } = useDetail();

  const rows = useMemo<JunkRow[]>(() => (junks ?? []).map((junk) => ({
    ...junk,
    drops: (dropsByJunk.get(junk.name) as EquipmentListItem[] | undefined)?.length ?? 0,
  })), [junks, dropsByJunk]);

  const columns: Column<JunkRow>[] = [
    {
      key: 'name',
      header: 'Junk',
      width: '3fr',
      minWidth: 200,
      sortValue: (row) => row.name.toLowerCase(),
      render: (row) => <TruncatedText fw={500}>{row.name}</TruncatedText>,
    },
    {
      key: 'quality',
      header: 'Max ★',
      width: '90px',
      minWidth: 84,
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
      key: 'drops',
      header: 'Drops',
      width: '64px',
      minWidth: 60,
      align: 'right',
      sortValue: (row) => row.drops,
      render: (row) => (row.drops
        ? <Text>{row.drops}</Text>
        : <Text c="dimmed">—</Text>),
    },
    {
      key: 'pools',
      header: 'Notes',
      width: '1fr',
      minWidth: 130,
      sortValue: (row) => (row.hasMultiplePools ? 1 : 0),
      render: (row) => (row.hasMultiplePools ? (
        <Badge
          size="sm"
          variant="light"
          color="yellow"
          leftSection={<IconInfoCircle size={12} />}
        >
          Multiple pools
        </Badge>
      ) : null),
    },
  ];

  return (
    <Stack gap="md">
      <Title order={2}>Junk</Title>

      {status === 'maintenance' && (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle />} title="Updating data">
          {maintenanceMessage}
        </Alert>
      )}
      {status === 'error' && (
        <Alert color="red" variant="light">Couldn&apos;t load the junk list — try refreshing.</Alert>
      )}

      {status === 'loading' && (
        <Center mih={200}><Loader color="crimson" /></Center>
      )}

      {junks && (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.name}
          searchText={(row) => row.name}
          searchPlaceholder="Filter junk by name"
          emptyMessage="No junk by that name."
          onRowClick={(row) => openJunk(row.name)}
        />
      )}
    </Stack>
  );
}

export function JunkListView() {
  return (
    <DetailProvider>
      <JunkListContent />
    </DetailProvider>
  );
}
