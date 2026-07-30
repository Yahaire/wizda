'use client';

import { useMemo, useRef, useState } from 'react';

import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useSelectOnFocus } from '@/hooks/useSelectOnFocus';
import { useStrings } from '@/i18n/LanguageProvider';
import { createSearchMatcher, normalize } from '@/utils/search';
import { Box, Center, CloseButton, Group, Text, TextInput, UnstyledButton } from '@mantine/core';
import {
    IconArrowsSort, IconSearch, IconSortAscending, IconSortDescending
} from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';

export type ColumnAlign = 'left' | 'right' | 'center';

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
  align?: ColumnAlign,
}

type SortDir = 'asc' | 'desc';

interface DataTableProps<T> {
  data: T[],
  columns: Column<T>[],
  getRowId: (row: T) => string,
  /**
   * Every text a row can be matched on by the search box — typically its display
   * name plus, in Japanese, the reading the API sends alongside it (a query may
   * satisfy one term from each). Nullish entries are dropped, so a row without a
   * reading needs no special-casing at the call site.
   *
   * Keep this stable (`useCallback`) — every row's text is folded once and cached
   * against this function's identity, and a fresh one each render throws that
   * cache away.
   */
  searchTexts: (row: T) => readonly (string | null | undefined)[],
  searchPlaceholder?: string,
  /** Extra filter controls (e.g. a rank select) shown beside the search box. */
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

/** A column's `align` as a grid/flex alignment value, so header and cells agree. */
function alignToJustify(align: ColumnAlign | undefined): 'start' | 'end' | 'center' {
  if (align === 'right') {
    return 'end';
  }
  if (align === 'center') {
    return 'center';
  }
  return 'start';
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchTexts,
  searchPlaceholder,
  toolbar,
  rowHeight = 48,
  height = 560,
  emptyMessage,
  onRowClick,
}: DataTableProps<T>) {
  const strings = useStrings();
  const resolvedSearchPlaceholder = searchPlaceholder ?? strings.common.defaultSearchPlaceholder;
  const resolvedEmptyMessage = emptyMessage ?? strings.common.defaultEmptyMessage;
  const { value: query, setValue: setQuery, debounced: debouncedQuery, compositionProps } =
    useDebouncedSearch();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref: searchRef, selectOnFocus: selectSearch } = useSelectOnFocus<HTMLInputElement>();

  // Row text never changes between keystrokes, only the query does — so fold it
  // once here rather than re-normalizing the whole catalog on every character.
  const haystacks = useMemo(
    () => data.map((row) => ({
      row,
      texts: searchTexts(row).filter((text): text is string => Boolean(text)).map(normalize),
    })),
    [data, searchTexts],
  );

  const rows = useMemo(() => {
    const matcher = createSearchMatcher(debouncedQuery);
    const filtered = debouncedQuery.trim()
      ? haystacks.filter((entry) => matcher.matchesNormalized(entry.texts)).map((entry) => entry.row)
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
  }, [data, haystacks, debouncedQuery, sortKey, sortDir, columns]);

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
          placeholder={resolvedSearchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onFocus={selectSearch}
          w={{ base: '100%', xs: 260 }}
          {...compositionProps}
        />
        {toolbar}
        <Text size="sm" c="dimmed">{strings.common.rowsShown(rows.length)}</Text>
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
                  <UnstyledButton onClick={() => toggleSort(column.key)}>
                    <Group gap={4} wrap="nowrap">
                      <Text size="sm" fw={600}>{column.header}</Text>
                      {sortIcon(column.key)}
                    </Group>
                  </UnstyledButton>
                ) : (
                  <Text size="sm" fw={600}>{column.header}</Text>
                );
                return (
                  <Box
                    key={column.key}
                    style={{
                      // Flex rather than `justifySelf` on the inner element: the
                      // grid item is this Box, so alignment set inside it is a
                      // no-op — which is how the header used to drift left of a
                      // right-aligned column's cells.
                      display: 'flex',
                      justifyContent: alignToJustify(column.align),
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
                <Text c="dimmed">{resolvedEmptyMessage}</Text>
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
                            justifySelf: alignToJustify(column.align),
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
