'use client';

import {
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Box,
  Center,
  CloseButton,
  Group,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowsSort,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { useSelectOnFocus } from '@/hooks/useSelectOnFocus';

export interface Column<T> {
  key: string,
  header: string,
  render: (row: T) => React.ReactNode,
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number,
  /** CSS grid track, e.g. '2fr', '120px'. Defaults to '1fr'. */
  width?: string,
  /** Minimum px width; the table scrolls horizontally rather than crush below it. */
  minWidth?: number,
  align?: 'left' | 'right' | 'center',
}

type SortDir = 'asc' | 'desc';

interface DataTableProps<T> {
  data: T[],
  columns: Column<T>[],
  getRowId: (row: T) => string,
  /** Lower-cased text a row is matched against by the search box. */
  searchText: (row: T) => string,
  searchPlaceholder?: string,
  /** Extra filter controls (e.g. a tier select) shown beside the search box. */
  toolbar?: React.ReactNode,
  rowHeight?: number,
  height?: number,
  emptyMessage?: string,
  /** When set, rows are clickable (e.g. to open a detail modal). */
  onRowClick?: (row: T) => void,
}

const DEFAULT_MIN_WIDTH = 90;
const GAP = 12;
const PAD_X = 14;
const HEADER_BG = 'var(--mantine-color-dark-6)';

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchText,
  searchPlaceholder = 'Filter by name',
  toolbar,
  rowHeight = 48,
  height = 560,
  emptyMessage = 'Nothing matches.',
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref: searchRef, selectOnFocus: selectSearch } = useSelectOnFocus<HTMLInputElement>();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? data.filter((row) => searchText(row).includes(needle))
      : data;

    if (!sortKey) {
      return filtered;
    }
    const column = columns.find((entry) => entry.key === sortKey);
    if (!column?.sortValue) {
      return filtered;
    }
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const a = column.sortValue!(left);
      const b = column.sortValue!(right);
      if (a < b) {
        return -1 * direction;
      }
      if (a > b) {
        return 1 * direction;
      }
      return 0;
    });
  }, [data, query, sortKey, sortDir, columns, searchText]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  // The first column is sticky (pinned while scrolling sideways) so mobile users
  // keep the row's identity in view. Cap its floor at half the visible width
  // (50cqw, resolved against the horizontally-scrolling container below) so it
  // can't eat most of a narrow screen; on wider viewports its px min wins.
  const gridTemplate = columns
    .map((column, index) => {
      const min = column.minWidth ?? DEFAULT_MIN_WIDTH;
      const lower = index === 0 ? `min(${min}px, 50cqw)` : `${min}px`;
      return `minmax(${lower}, ${column.width ?? '1fr'})`;
    })
    .join(' ');

  // Force a min table width so it scrolls horizontally instead of crushing on
  // narrow screens.
  const minTableWidth = columns.reduce(
    (sum, column) => sum + (column.minWidth ?? DEFAULT_MIN_WIDTH),
    GAP * (columns.length - 1) + PAD_X * 2,
  );

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const sortIcon = (key: string) => {
    if (sortKey !== key) {
      return <IconArrowsSort size={14} opacity={0.4} />;
    }
    return sortDir === 'asc'
      ? <IconSortAscending size={14} />
      : <IconSortDescending size={14} />;
  };

  /** Sticky-left positioning for the first column so it stays put scrolling sideways. */
  const stickyPos = (index: number): React.CSSProperties => (
    index === 0
      ? {
        position: 'sticky',
        left: 0,
        zIndex: 1,
      }
      : {}
  );

  return (
    <div>
      <Group justify="space-between" mb="sm" gap="sm" wrap="wrap">
        <TextInput
          ref={searchRef}
          leftSection={<IconSearch size={16} />}
          rightSection={query && (
            <CloseButton
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery('')}
            />
          )}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onFocus={selectSearch}
          w={{ base: '100%', xs: 260 }}
        />
        {toolbar}
        <Text size="sm" c="dimmed">{rows.length} shown</Text>
      </Group>

      <Box
        style={{
          border: '1px solid var(--mantine-color-dark-4)',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
          // `containerType: inline-size` makes this (the full-width, non-scrolling
          // frame) the reference for the first column's `50cqw` floor — see
          // gridTemplate. It lives here rather than on the scroller below so it
          // can't interfere with that box's sticky/scroll behaviour.
          containerType: 'inline-size',
        }}
      >
        {/* A single box scrolls both axes so the sticky header (top) and sticky
            first column (left) share one scroll container. With two nested
            scrollers, a row's sticky-left cell would resolve to the inner
            (vertical) scroller and slide away with the outer horizontal scroll. */}
        <div
          ref={scrollRef}
          style={{
            overflow: 'auto',
            height: rows.length === 0 ? undefined : height,
          }}
        >
          <Box style={{ minWidth: minTableWidth, position: 'relative' }}>
            {/* Header — sticky to the top of the scroller. */}
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                gap: GAP,
                padding: `10px ${PAD_X}px`,
                background: HEADER_BG,
                borderBottom: '1px solid var(--mantine-color-dark-4)',
                position: 'sticky',
                top: 0,
                zIndex: 3,
              }}
            >
              {columns.map((column, index) => {
                const inner = column.sortValue ? (
                  <UnstyledButton
                    onClick={() => toggleSort(column.key)}
                    style={{ justifySelf: column.align === 'right' ? 'end' : 'start' }}
                  >
                    <Group gap={4} wrap="nowrap">
                      <Text size="sm" fw={600}>{column.header}</Text>
                      {sortIcon(column.key)}
                    </Group>
                  </UnstyledButton>
                ) : (
                  <Text size="sm" fw={600} ta={column.align ?? 'left'}>
                    {column.header}
                  </Text>
                );
                return (
                  <Box
                    key={column.key}
                    style={{
                      ...stickyPos(index),
                      ...(index === 0 ? { background: HEADER_BG, zIndex: 2 } : {}),
                    }}
                  >
                    {inner}
                  </Box>
                );
              })}
            </Box>

            {/* Body */}
            {rows.length === 0 ? (
              <Center p="xl">
                <Text c="dimmed">{emptyMessage}</Text>
              </Center>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index]!;
                  return (
                    <Box
                      key={getRowId(row)}
                      className={onRowClick ? 'wizda-row-hover' : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      style={{
                        position: 'absolute',
                        top: virtualRow.start,
                        left: 0,
                        width: '100%',
                        height: rowHeight,
                        display: 'grid',
                        gridTemplateColumns: gridTemplate,
                        gap: GAP,
                        alignItems: 'center',
                        padding: `0 ${PAD_X}px`,
                        borderBottom: '1px solid var(--mantine-color-dark-5)',
                      }}
                    >
                      {columns.map((column, index) => (
                        <Box
                          key={column.key}
                          className={index === 0 ? 'wizda-sticky-cell' : undefined}
                          style={{
                            justifySelf: column.align === 'right'
                              ? 'end'
                              : column.align === 'center' ? 'center' : 'start',
                            minWidth: 0,
                            width: '100%',
                            textAlign: column.align ?? 'left',
                            ...stickyPos(index),
                          }}
                        >
                          {column.render(row)}
                        </Box>
                      ))}
                    </Box>
                  );
                })}
              </div>
            )}
          </Box>
        </div>
      </Box>
    </div>
  );
}
