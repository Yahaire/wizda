'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { usePathname } from 'next/navigation';

import { CategoryIcon } from '@/components/CategoryIcon';
import { getRankColor, GradeBadge, QualityStars } from '@/components/gear/gearDisplays';
import { TruncatedText } from '@/components/TruncatedText';
import { api, MaintenanceError } from '@/services/api';
import {
    ActionIcon, Alert, Badge, Box, Divider, Group, Modal, ScrollArea, Stack, Text, UnstyledButton
} from '@mantine/core';
import { TsUtilities } from '@shared/tsUtilities';
import {
    IconArrowLeft, IconArrowsSort, IconChevronRight, IconInfoCircle, IconSortAscending,
    IconSortDescending
} from '@tabler/icons-react';

import type {
  EquipmentListItem,
  JunkListItem,
} from '@shared/api/endpoints/lists.models';

const MULTI_POOL_NOTE = TsUtilities.stringJoin([
  "This junk has more than one recorded drop pool — only the newest is stored.",
  "If you haven't unlocked this area's newer pool, or you still have junks from the",
  "previous version, your actual drops may differ.",
]);

/**
 * Both detail lists (a junk's gear, an equipment's junks) share one grid so
 * their columns line up and can't drift: name (fills) · quality · grade · a
 * chevron. The chevron is a tap affordance — on mobile there's no hover, so
 * without it a clickable row reads as static text. Each row (and the header) is
 * a subgrid spanning all four tracks, so column widths are measured once across
 * every row.
 */
const DETAIL_LIST_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto auto',
  columnGap: 'var(--mantine-spacing-xs)',
  rowGap: 2,
};

const DETAIL_ROW_GRID: React.CSSProperties = {
  display: 'grid',
  gridColumn: '1 / -1',
  gridTemplateColumns: 'subgrid',
  alignItems: 'center',
  borderRadius: 'var(--mantine-radius-sm)',
};

// Small and tucked (negative margin eats part of the column gap) so the
// affordance doesn't steal width from the name/badges on narrow screens.
const ROW_CHEVRON = <IconChevronRight size={12} style={{ opacity: 0.4, marginInlineStart: -4 }} />;

/** One row of a detail list, flattened so both lists sort through one path. */
interface DetailListRow {
  /** Sorted on, and matched against the parent entry's `focusChild`. */
  name: string,
  /** The name cell's content — plain text for junks, icon + text for gear. */
  label: React.ReactNode,
  quality: number | null,
  grade: number | null,
}

type DetailSortKey = 'name' | 'quality' | 'grade';
type SortDir = 'asc' | 'desc';

// Rows with no recorded quality/grade sort below every row that has one, in
// both directions — an unknown isn't a low value, and burying it beats letting
// it head the list on a descending sort.
function compareRows(left: DetailListRow, right: DetailListRow, key: DetailSortKey): number {
  if (key === 'name') {
    return left.name.localeCompare(right.name);
  }
  const a = left[key];
  const b = right[key];
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a - b;
}

function DetailListHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string,
  sortKey: DetailSortKey,
  activeKey: DetailSortKey | null,
  dir: SortDir,
  onSort: (key: DetailSortKey) => void,
}) {
  const active = activeKey === sortKey;
  const icon = !active
    ? <IconArrowsSort size={12} opacity={0.4} />
    : dir === 'asc' ? <IconSortAscending size={12} /> : <IconSortDescending size={12} />;
  return (
    <UnstyledButton
      onClick={() => onSort(sortKey)}
      style={{ justifySelf: 'start' }}
      aria-label={`Sort by ${label.toLowerCase()}`}
    >
      <Group gap={4} wrap="nowrap">
        <Text size="xs" fw={600} c={active ? undefined : 'dimmed'}>{label}</Text>
        {icon}
      </Group>
    </UnstyledButton>
  );
}

/**
 * The scrollable, sortable body shared by both detail views. Sort state lives
 * here and is deliberately not lifted: each view mounts its own instance, so
 * navigating a cross-link starts the next list back at its natural (as-recorded)
 * order rather than inheriting a sort chosen for a different list.
 */
function DetailList({
  rows,
  focusChild,
  focusedRowRef,
  onRowClick,
}: {
  rows: DetailListRow[],
  focusChild: string | null,
  focusedRowRef: React.Ref<HTMLButtonElement>,
  onRowClick: (name: string) => void,
}) {
  const [sortKey, setSortKey] = useState<DetailSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: DetailSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const sorted = useMemo(() => {
    if (!sortKey) {
      return rows;
    }
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => direction * compareRows(left, right, sortKey));
  }, [rows, sortKey, sortDir]);

  const headerProps = { activeKey: sortKey, dir: sortDir, onSort: toggleSort };

  return (
    <ScrollArea.Autosize mah={360}>
      <Box style={DETAIL_LIST_GRID}>
        {/* Sticky so the columns stay labelled while the list scrolls. It's a
            subgrid row like any other, so it can't drift out of alignment. */}
        <Box
          px="xs"
          pb={4}
          style={{
            ...DETAIL_ROW_GRID,
            position: 'sticky',
            top: 0,
            zIndex: 1,
            background: 'var(--mantine-color-body)',
          }}
        >
          <DetailListHeader label="Name" sortKey="name" {...headerProps} />
          <DetailListHeader label="Quality" sortKey="quality" {...headerProps} />
          <DetailListHeader label="Grade" sortKey="grade" {...headerProps} />
          {/* Empty fourth cell, holding the chevron column's width. */}
          <Box />
        </Box>

        {sorted.map((row) => (
          <UnstyledButton
            key={row.name}
            ref={focusChild === row.name ? focusedRowRef : undefined}
            className={focusChild === row.name ? 'wizda-row-hover wizda-row-focused' : 'wizda-row-hover'}
            onClick={() => onRowClick(row.name)}
            p="xs"
            style={DETAIL_ROW_GRID}
          >
            {row.label}
            <Box style={{ justifySelf: 'start' }}>
              {row.quality ? <QualityStars value={row.quality} size={11} /> : null}
            </Box>
            <Box style={{ justifySelf: 'start' }}>
              {row.grade ? <GradeBadge value={row.grade} /> : null}
            </Box>
            {ROW_CHEVRON}
          </UnstyledButton>
        ))}
      </Box>
    </ScrollArea.Autosize>
  );
}

// A 503 (maintenance) doesn't reach 'error' — the global MaintenanceGate owns
// that screen, so the list views just stay in 'loading' until it clears.
// 'idle' is the pre-fetch state: either the provider hasn't yet reached a route
// that needs the lists, or a load already failed and is waiting on a full
// refresh (see the route effect below) rather than retrying itself.
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

// Routes that don't use the junk/equipment lists — skip the fetch on them so
// e.g. the About page doesn't pull data it never renders.
const ROUTES_WITHOUT_LISTS = new Set(['/about']);

interface DetailContextValue {
  equipment: EquipmentListItem[] | null,
  junks: JunkListItem[] | null,
  dropsByJunk: Map<string, EquipmentListItem[]>,
  status: LoadStatus,
  openEquipment: (name: string, backable?: boolean) => void,
  openJunk: (name: string, backable?: boolean) => void,
}

const DetailContext = createContext<DetailContextValue | null>(null);

export function useDetail(): DetailContextValue {
  const context = useContext(DetailContext);
  if (!context) {
    throw new Error('useDetail must be used inside a <DetailProvider>');
  }
  return context;
}

/**
 * One entry in the detail-view navigation stack — either an equipment or a junk
 * detail. Cross-links push a new entry; the modal's Back arrow pops one.
 * `focusChild` is the name of the row that was clicked to drill deeper from this
 * entry; when we pop back to it, that row is scrolled into view and highlighted
 * so the user re-orients to where they were.
 */
type DetailEntry =
  | { kind: 'equipment', item: EquipmentListItem, focusChild?: string }
  | { kind: 'junk', item: JunkListItem, focusChild?: string };

/**
 * Push `entry` onto the stack, recording on the entry we're leaving which child
 * row (`focusChild`) sent us there — see `DetailEntry.focusChild`.
 */
function pushWithFocus(
  stack: DetailEntry[],
  entry: DetailEntry,
  focusChild: string,
): DetailEntry[] {
  if (stack.length === 0) {
    return [entry];
  }
  const parent = { ...stack[stack.length - 1], focusChild };
  return [...stack.slice(0, -1), parent, entry];
}

/**
 * Mounted once at the app layout. Loads the junk + equipment reference lists
 * and hosts a single shared detail modal, so any row (in either list, or
 * inside the modal itself, or the Oracle's equipment select) can open the same
 * detail view. The lists load once per session — the first time a route that
 * needs them is reached (see `ROUTES_WITHOUT_LISTS`) — and then persist across
 * client navigation; they are not refetched on every route change. A failed
 * load stays in `'error'` until a full page refresh remounts this provider —
 * it does not retry on soft navigation.
 *
 * Cross-links between junk and equipment build a navigation stack: following
 * one pushes it on top, and a Back arrow returns to the previous view (rather
 * than closing and reopening), so you can retrace e.g. equipment → junk →
 * equipment. Closing the modal clears the whole stack.
 */
export function DetailProvider({ children }: { children: React.ReactNode }) {
  const [equipment, setEquipment] = useState<EquipmentListItem[] | null>(null);
  const [junks, setJunks] = useState<JunkListItem[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');

  const [detailStack, setDetailStack] = useState<DetailEntry[]>([]);

  // True when the modal was opened from a view that stays mounted behind it (the
  // per-result summary), so the root-level Back arrow closes this modal to reveal
  // that view — rather than there being nothing to go back to (a list-table open).
  const [rootBackable, setRootBackable] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'idle' || ROUTES_WITHOUT_LISTS.has(pathname)) {
      return;
    }
    let alive = true;
    setStatus('loading');
    Promise.all([api.listEquipment(), api.listJunks()])
      .then(([equipmentList, junkList]) => {
        if (!alive) {
          return;
        }
        setEquipment(equipmentList);
        setJunks(junkList);
        setStatus('ready');
      })
      .catch((error) => {
        if (!alive) {
          return;
        }
        // A 503 here is handled by the global MaintenanceGate; anything else
        // is a genuine load failure.
        if (!(error instanceof MaintenanceError)) {
          setStatus('error');
        }
      });
    return () => {
      alive = false;
    };
    // `status` deliberately excluded: this effect sets it itself
    // ('idle' → 'loading'), and re-running on that transition would fire the
    // cleanup above — flipping `alive` false on the fetch this very call just
    // started, before it resolves. Re-checking only needs to happen on a route
    // change; the guard above reads the latest `status` via closure regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const equipmentByName = useMemo(() => {
    const map = new Map<string, EquipmentListItem>();
    for (const item of equipment ?? []) {
      map.set(item.name, item);
    }
    return map;
  }, [equipment]);

  const junkByName = useMemo(() => {
    const map = new Map<string, JunkListItem>();
    for (const item of junks ?? []) {
      map.set(item.name, item);
    }
    return map;
  }, [junks]);

  const dropsByJunk = useMemo(() => {
    const map = new Map<string, EquipmentListItem[]>();
    for (const item of equipment ?? []) {
      for (const source of item.sources) {
        const list = map.get(source.junkName) ?? [];
        list.push(item);
        map.set(source.junkName, list);
      }
    }
    return map;
  }, [equipment]);

  const resolveEquipment = (name: string): EquipmentListItem => (
    equipmentByName.get(name)
    ?? {
      name,
      displayName: name,
      category: null,
      rank: null,
      maxDropQuality: null,
      maxDropGrade: null,
      blessings: [],
      sources: [],
    }
  );
  const resolveJunk = (name: string): JunkListItem => (
    junkByName.get(name)
    ?? { name, displayName: name, hasMultiplePools: false, maxDropQuality: null, maxDropGrade: null }
  );

  // Opening from a list starts a fresh stack; cross-links push onto it, tagging
  // the parent with the clicked row so Back can restore focus. Back pops one
  // level; closing the modal clears the stack entirely.
  const pushEquipment = (item: EquipmentListItem) => setDetailStack((stack) => pushWithFocus(stack, { kind: 'equipment', item }, item.name));
  const pushJunk = (name: string) => setDetailStack((stack) => pushWithFocus(stack, { kind: 'junk', item: resolveJunk(name) }, name));
  const goBack = () => setDetailStack((stack) => stack.slice(0, -1));
  const closeDetail = () => {
    setDetailStack([]);
    setRootBackable(false);
  };

  const value = useMemo<DetailContextValue>(() => ({
    equipment,
    junks,
    dropsByJunk,
    status,
    openEquipment: (name, backable = false) => {
      setDetailStack([{ kind: 'equipment', item: resolveEquipment(name) }]);
      setRootBackable(backable);
    },
    openJunk: (name, backable = false) => {
      setDetailStack([{ kind: 'junk', item: resolveJunk(name) }]);
      setRootBackable(backable);
    },
  }), [equipment, junks, dropsByJunk, status, equipmentByName, junkByName]);

  const current = detailStack.at(-1) ?? null;
  const junkDrops = useMemo<EquipmentListItem[]>(() => (
    current?.kind === 'junk' ? dropsByJunk.get(current.item.name) ?? [] : []
  ), [current, dropsByJunk]);

  // The junks an equipment drops from.
  const sourceRows = useMemo<DetailListRow[]>(() => (
    current?.kind !== 'equipment' ? [] : current.item.sources.map((source) => ({
      name: source.junkName,
      label: <TruncatedText size="sm" style={{ minWidth: 0 }}>{source.junkName}</TruncatedText>,
      quality: source.maxDropQuality,
      grade: source.maxDropGrade,
    }))
  ), [current]);

  // The gear a junk drops. Quality/grade are what the piece drops at *from this
  // junk*, not its global best across every junk (piece.maxDrop*).
  const dropRows = useMemo<DetailListRow[]>(() => (
    current?.kind !== 'junk' ? [] : junkDrops.map((piece) => {
      const here = piece.sources.find((source) => source.junkName === current.item.name);
      return {
        name: piece.name,
        label: (
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <CategoryIcon
              size={14}
              categoryCode={piece.category?.code}
              color={getRankColor(piece.rank) ?? 'var(--mantine-color-dimmed)'}
              style={{ flexShrink: 0 }}
            />
            <TruncatedText size="sm" style={{ minWidth: 0 }}>{piece.name}</TruncatedText>
          </Group>
        ),
        quality: here?.maxDropQuality ?? null,
        grade: here?.maxDropGrade ?? null,
      };
    })
  ), [current, junkDrops]);

  // The Back arrow retraces a cross-link when we're deep in the stack, or — at the
  // root — closes back to the view still mounted behind us (e.g. the per-result
  // summary). It stays hidden for a root opened straight from a list table.
  const showBack = detailStack.length > 1 || rootBackable;
  const goBackOrClose = () => {
    if (detailStack.length > 1) {
      goBack();
      return;
    }
    closeDetail();
  };

  // On navigation (incl. Back), bring the row we came from into view. The ref is
  // attached only to the row whose name matches the current entry's focusChild.
  const focusChild = current?.focusChild ?? null;
  const focusedRowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusChild) {
      return;
    }
    focusedRowRef.current?.scrollIntoView({ block: 'center' });
  }, [detailStack, focusChild]);

  return (
    <DetailContext.Provider value={value}>
      {children}

      <Modal
        opened={detailStack.length > 0}
        onClose={closeDetail}
        size="lg"
        // Sits above any modal that opened it (e.g. the per-result summary, which
        // stays mounted behind at Mantine's default z-index of 200).
        zIndex={300}
        title={(
          <Group gap="xs" wrap="nowrap">
            {showBack && (
              <ActionIcon variant="subtle" color="gray" onClick={goBackOrClose} aria-label="Back">
                <IconArrowLeft size={18} />
              </ActionIcon>
            )}
            <Text fw={600}>
              {current?.kind === 'junk' ? 'Junk details' : 'Equipment details'}
            </Text>
          </Group>
        )}
      >
        {current?.kind === 'equipment' && (
          <Stack gap="sm">
            <Group gap="xs" wrap="nowrap">
              <CategoryIcon
                size={20}
                categoryCode={current.item.category?.code}
                color={getRankColor(current.item.rank) ?? 'var(--mantine-color-dimmed)'}
              />
              <Text fw={600} fz="lg">{current.item.name}</Text>
            </Group>
            <Group gap="lg">
              {current.item.rank && (
                <Group gap={6}>
                  <Text c="dimmed" size="sm">Rank</Text>
                  <Badge variant="light" color="gray" size="sm">{current.item.rank}</Badge>
                </Group>
              )}
              {current.item.maxDropQuality && (
                <Group gap={6}>
                  <Text c="dimmed" size="sm">Max</Text>
                  <QualityStars value={current.item.maxDropQuality} />
                </Group>
              )}
              {current.item.maxDropGrade && (
                <Group gap={6}>
                  <Text c="dimmed" size="sm">Grade</Text>
                  <GradeBadge value={current.item.maxDropGrade} />
                </Group>
              )}
            </Group>
            <Divider label={current.item.sources.length === 0
              ? 'Junk sources'
              : `Drops from ${current.item.sources.length} junk${current.item.sources.length === 1 ? '' : 's'}`} />
            {current.item.sources.length === 0 ? (
              <Text c="dimmed" size="sm">No junk drops this one — so there&apos;s nothing for me to count here yet.</Text>
            ) : (
              <DetailList
                // Remounts per entry, so each list starts at its own natural
                // order rather than inheriting the last view's sort.
                key={current.item.name}
                rows={sourceRows}
                focusChild={focusChild}
                focusedRowRef={focusedRowRef}
                onRowClick={pushJunk}
              />
            )}
          </Stack>
        )}

        {current?.kind === 'junk' && (
          <Stack gap="sm">
            <Text fw={600} fz="lg">{current.item.name}</Text>
            {current.item.hasMultiplePools && (
              <Alert color="yellow" variant="light" icon={<IconInfoCircle />}>
                {MULTI_POOL_NOTE}
              </Alert>
            )}
            {(current.item.maxDropQuality || current.item.maxDropGrade) && (
              <Group gap="lg">
                <Text c="dimmed" size="sm">At best it drops</Text>
                {current.item.maxDropQuality && <QualityStars value={current.item.maxDropQuality} />}
                {current.item.maxDropGrade && <GradeBadge value={current.item.maxDropGrade} />}
              </Group>
            )}
            <Divider label={`Drops ${junkDrops.length} piece${junkDrops.length === 1 ? '' : 's'} of gear`} />
            {junkDrops.length === 0 ? (
              <Text c="dimmed" size="sm">No droppable gear on record.</Text>
            ) : (
              <DetailList
                key={current.item.name}
                rows={dropRows}
                focusChild={focusChild}
                focusedRowRef={focusedRowRef}
                onRowClick={(name) => pushEquipment(resolveEquipment(name))}
              />
            )}
          </Stack>
        )}
      </Modal>
    </DetailContext.Provider>
  );
}
