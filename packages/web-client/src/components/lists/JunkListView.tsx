'use client';

import { Suspense, useCallback, useMemo } from 'react';

import { useDetail } from '@/components/detail/DetailProvider';
import { GradeBadge, QualityStars } from '@/components/gear/gearDisplays';
import { PageTitle } from '@/components/PageTitle';
import { Column, DataTable } from '@/components/table/DataTable';
import { TruncatedText } from '@/components/TruncatedText';
import { useSearchQueryParam } from '@/hooks/useSearchQueryParam';
import { useStrings } from '@/i18n/LanguageProvider';
import { Alert, Badge, Center, Loader, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import type {
  EquipmentListItem,
  JunkListItem,
} from '@shared/api/endpoints/lists.models';

interface JunkRow extends JunkListItem {
  drops: number,
}

function JunkListContent() {
  const strings = useStrings();
  const { initialQuery, syncQueryToUrl } = useSearchQueryParam();
  const {
    junks,
    dropsByJunk,
    status,
    openJunk,
  } = useDetail();

  const rows = useMemo<JunkRow[]>(() => (junks ?? []).map((junk) => ({
    ...junk,
    drops: (dropsByJunk.get(junk.name) as EquipmentListItem[] | undefined)?.length ?? 0,
  })), [junks, dropsByJunk]);

  // Stable so DataTable's folded-text cache survives re-renders. `nameReading`
  // is present only in Japanese, and is what lets a kana query reach a kanji name.
  const junkSearchTexts = useCallback((row: JunkRow) => [row.displayName, row.nameReading], []);

  const columns: Column<JunkRow>[] = [
    {
      key: 'name',
      header: strings.lists.junkTitle,
      width: '3fr',
      minWidth: 200,
      sortValue: (row) => row.displayName.toLowerCase(),
      render: (row) => <TruncatedText fw={500}>{row.displayName}</TruncatedText>,
    },
    {
      key: 'quality',
      header: strings.lists.columnMaxQuality,
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
      header: strings.lists.columnMaxGrade,
      width: '110px',
      minWidth: 108,
      sortValue: (row) => row.maxDropGrade ?? 0,
      render: (row) => (row.maxDropGrade
        ? <GradeBadge value={row.maxDropGrade} />
        : <Text c="dimmed">—</Text>),
    },
    {
      key: 'drops',
      header: strings.lists.columnDrops,
      width: '64px',
      minWidth: 60,
      align: 'center',
      sortValue: (row) => row.drops,
      render: (row) => (row.drops
        ? <Text>{row.drops}</Text>
        : <Text c="dimmed">—</Text>),
    },
    {
      key: 'pools',
      header: strings.lists.columnNotes,
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
          {strings.lists.multiplePoolsLabel}
        </Badge>
      ) : null),
    },
  ];

  return (
    <Stack gap="md">
      <PageTitle shareable>{strings.lists.junkTitle}</PageTitle>

      {status === 'error' && (
        <Alert color="red" variant="light">{strings.lists.junkLoadError}</Alert>
      )}

      {status === 'loading' && (
        <Center mih={200}><Loader color="crimson" /></Center>
      )}

      {junks && (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.name}
          searchTexts={junkSearchTexts}
          searchPlaceholder={strings.lists.junkSearchPlaceholder}
          emptyMessage={strings.lists.junkEmptyMessage}
          onRowClick={(row) => openJunk(row.name)}
          initialQuery={initialQuery}
          onQueryChange={syncQueryToUrl}
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
export function JunkListView() {
  return (
    <Suspense fallback={<Center mih={200}><Loader color="crimson" /></Center>}>
      <JunkListContent />
    </Suspense>
  );
}
