'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CategoryIcon, getEquipmentType } from '@/components/CategoryIcon';
import { getTierColor, GradeBadge, QualityStars } from '@/components/gear/gearDisplays';
import { TruncatedText } from '@/components/TruncatedText';
import { api, MaintenanceError } from '@/services/api';
import {
    ActionIcon, Alert, Badge, Box, Divider, Group, Modal, ScrollArea, Stack, Text, UnstyledButton
} from '@mantine/core';
import { TsUtilities } from '@shared/tsUtilities';
import { IconArrowLeft, IconChevronRight, IconInfoCircle } from '@tabler/icons-react';

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
 * without it a clickable row reads as static text. Each row is a subgrid
 * spanning all four tracks, so column widths are measured once across rows.
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

type LoadStatus = 'loading' | 'ready' | 'maintenance' | 'error';

interface DetailContextValue {
  equipment: EquipmentListItem[] | null,
  junks: JunkListItem[] | null,
  dropsByJunk: Map<string, EquipmentListItem[]>,
  status: LoadStatus,
  maintenanceMessage: string | null,
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
 * Loads the junk + equipment reference lists once and hosts a single shared
 * detail modal, so any row (in either list, or inside the modal itself) can open
 * the same detail view. Cross-links between junk and equipment build a
 * navigation stack: following one pushes it on top, and a Back arrow returns to
 * the previous view (rather than closing and reopening), so you can retrace e.g.
 * equipment → junk → equipment. Closing the modal clears the whole stack.
 */
export function DetailProvider({ children }: { children: React.ReactNode }) {
  const [equipment, setEquipment] = useState<EquipmentListItem[] | null>(null);
  const [junks, setJunks] = useState<JunkListItem[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);

  const [detailStack, setDetailStack] = useState<DetailEntry[]>([]);

  // True when the modal was opened from a view that stays mounted behind it (the
  // per-result summary), so the root-level Back arrow closes this modal to reveal
  // that view — rather than there being nothing to go back to (a list-table open).
  const [rootBackable, setRootBackable] = useState(false);

  useEffect(() => {
    let alive = true;
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
        if (error instanceof MaintenanceError) {
          setMaintenanceMessage(error.message);
          setStatus('maintenance');
        } else {
          setStatus('error');
        }
      });
    return () => {
      alive = false;
    };
  }, []);

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
    ?? { name, category: null, tier: null, maxDropQuality: null, maxDropGrade: null, sources: [] }
  );
  const resolveJunk = (name: string): JunkListItem => (
    junkByName.get(name)
    ?? { name, hasMultiplePools: false, maxDropQuality: null, maxDropGrade: null }
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
    maintenanceMessage,
    openEquipment: (name, backable = false) => {
      setDetailStack([{ kind: 'equipment', item: resolveEquipment(name) }]);
      setRootBackable(backable);
    },
    openJunk: (name, backable = false) => {
      setDetailStack([{ kind: 'junk', item: resolveJunk(name) }]);
      setRootBackable(backable);
    },
  }), [equipment, junks, dropsByJunk, status, maintenanceMessage, equipmentByName, junkByName]);

  const current = detailStack.at(-1) ?? null;
  const junkDrops = current?.kind === 'junk' ? dropsByJunk.get(current.item.name) ?? [] : [];

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
        centered
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
                equipmentType={getEquipmentType(current.item.category?.code)}
                color={getTierColor(current.item.tier) ?? 'var(--mantine-color-dimmed)'}
              />
              <Text fw={600} fz="lg">{current.item.name}</Text>
            </Group>
            <Group gap="lg">
              {current.item.tier && (
                <Group gap={6}>
                  <Text c="dimmed" size="sm">Tier</Text>
                  <Badge variant="light" color="gray" size="sm">{current.item.tier}</Badge>
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
            <Divider label={`Drops from ${current.item.sources.length} junk${current.item.sources.length === 1 ? '' : 's'}`} />
            {current.item.sources.length === 0 ? (
              <Text c="dimmed" size="sm">No junk sources on record.</Text>
            ) : (
              <ScrollArea.Autosize mah={360}>
                <Box style={DETAIL_LIST_GRID}>
                  {current.item.sources.map((source) => (
                    <UnstyledButton
                      key={source.junkName}
                      ref={focusChild === source.junkName ? focusedRowRef : undefined}
                      className={focusChild === source.junkName ? 'wizda-row-hover wizda-row-focused' : 'wizda-row-hover'}
                      onClick={() => pushJunk(source.junkName)}
                      p="xs"
                      style={DETAIL_ROW_GRID}
                    >
                      <TruncatedText size="sm" style={{ minWidth: 0 }}>{source.junkName}</TruncatedText>
                      <Box style={{ justifySelf: 'start' }}>
                        {source.maxDropQuality ? <QualityStars value={source.maxDropQuality} size={11} /> : null}
                      </Box>
                      <Box style={{ justifySelf: 'start' }}>
                        {source.maxDropGrade ? <GradeBadge value={source.maxDropGrade} /> : null}
                      </Box>
                      {ROW_CHEVRON}
                    </UnstyledButton>
                  ))}
                </Box>
              </ScrollArea.Autosize>
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
              <ScrollArea.Autosize mah={360}>
                <Box style={DETAIL_LIST_GRID}>
                  {junkDrops.map((piece) => {
                    // Show what this piece drops at *from this junk*, not its
                    // global best across every junk (piece.maxDrop*).
                    const here = piece.sources.find((source) => source.junkName === current.item.name);
                    return (
                      <UnstyledButton
                        key={piece.name}
                        ref={focusChild === piece.name ? focusedRowRef : undefined}
                        className={focusChild === piece.name ? 'wizda-row-hover wizda-row-focused' : 'wizda-row-hover'}
                        onClick={() => pushEquipment(piece)}
                        p="xs"
                        style={DETAIL_ROW_GRID}
                      >
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <CategoryIcon
                            size={14}
                            equipmentType={getEquipmentType(piece.category?.code)}
                            color={getTierColor(piece.tier) ?? 'var(--mantine-color-dimmed)'}
                            style={{ flexShrink: 0 }}
                          />
                          <TruncatedText size="sm" style={{ minWidth: 0 }}>{piece.name}</TruncatedText>
                        </Group>
                        <Box style={{ justifySelf: 'start' }}>
                          {here?.maxDropQuality ? <QualityStars value={here.maxDropQuality} size={11} /> : null}
                        </Box>
                        <Box style={{ justifySelf: 'start' }}>
                          {here?.maxDropGrade ? <GradeBadge value={here.maxDropGrade} /> : null}
                        </Box>
                        {ROW_CHEVRON}
                      </UnstyledButton>
                    );
                  })}
                </Box>
              </ScrollArea.Autosize>
            )}
          </Stack>
        )}
      </Modal>
    </DetailContext.Provider>
  );
}
