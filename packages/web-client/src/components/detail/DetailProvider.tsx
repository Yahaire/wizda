'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Badge,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronRight,
  IconInfoCircle,
} from '@tabler/icons-react';

import { TsUtilities } from '@shared/tsUtilities';
import type {
  EquipmentListItem,
  JunkListItem,
} from '@shared/api/endpoints/lists.models';

import {
  MaintenanceError,
  api,
} from '@/services/api';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TruncatedText } from '@/components/TruncatedText';
import {
  GradeBadge,
  QualityStars,
} from '@/components/gear/gearDisplays';

const MULTI_POOL_NOTE = TsUtilities.stringJoin([
  "This junk has more than one recorded drop pool — only the newest is stored.",
  "If you haven't unlocked this area's newer pool, or you still have junks from the",
  "previous version, your actual drops may differ.",
]);

type LoadStatus = 'loading' | 'ready' | 'maintenance' | 'error';

interface DetailContextValue {
  equipment: EquipmentListItem[] | null,
  junks: JunkListItem[] | null,
  dropsByJunk: Map<string, EquipmentListItem[]>,
  status: LoadStatus,
  maintenanceMessage: string | null,
  openEquipment: (name: string) => void,
  openJunk: (name: string) => void,
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
 * Loads the junk + equipment reference lists once and hosts the shared
 * junk/equipment detail modals, so any row (in either list, or inside the other
 * modal) can open the same detail view. The two modals cross-link: a junk's
 * gear opens the equipment modal and vice-versa.
 */
export function DetailProvider({ children }: { children: React.ReactNode }) {
  const [equipment, setEquipment] = useState<EquipmentListItem[] | null>(null);
  const [junks, setJunks] = useState<JunkListItem[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);

  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentListItem | null>(null);
  const [junkDetail, setJunkDetail] = useState<JunkListItem | null>(null);

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

  const value = useMemo<DetailContextValue>(() => ({
    equipment,
    junks,
    dropsByJunk,
    status,
    maintenanceMessage,
    openEquipment: (name) => setEquipmentDetail(equipmentByName.get(name) ?? { name, tier: null, maxDropQuality: null, maxDropGrade: null, sources: [] }),
    openJunk: (name) => setJunkDetail(junkByName.get(name) ?? { name, hasMultiplePools: false, maxDropQuality: null, maxDropGrade: null }),
  }), [equipment, junks, dropsByJunk, status, maintenanceMessage, equipmentByName, junkByName]);

  const junkDrops = junkDetail ? dropsByJunk.get(junkDetail.name) ?? [] : [];

  return (
    <DetailContext.Provider value={value}>
      {children}

      {/* Equipment detail */}
      <Modal
        opened={Boolean(equipmentDetail)}
        onClose={() => setEquipmentDetail(null)}
        title="Equipment details"
        centered
        size="lg"
      >
        {equipmentDetail && (
          <Stack gap="sm">
            <Group gap="xs" wrap="nowrap">
              <CategoryIcon size={20} color="var(--mantine-color-dimmed)" />
              <Text fw={600} fz="lg">{equipmentDetail.name}</Text>
            </Group>
            <Group gap="lg">
              {equipmentDetail.tier && (
                <Group gap={6}>
                  <Text c="dimmed" size="sm">Tier</Text>
                  <Badge variant="light" color="gray" size="sm">{equipmentDetail.tier}</Badge>
                </Group>
              )}
              {equipmentDetail.maxDropQuality && (
                <Group gap={6}>
                  <Text c="dimmed" size="sm">Max</Text>
                  <QualityStars value={equipmentDetail.maxDropQuality} />
                </Group>
              )}
              {equipmentDetail.maxDropGrade && (
                <Group gap={6}>
                  <Text c="dimmed" size="sm">Grade</Text>
                  <GradeBadge value={equipmentDetail.maxDropGrade} />
                </Group>
              )}
            </Group>
            <Divider label={`Drops from ${equipmentDetail.sources.length} junk${equipmentDetail.sources.length === 1 ? '' : 's'}`} />
            {equipmentDetail.sources.length === 0 ? (
              <Text c="dimmed" size="sm">No junk sources on record.</Text>
            ) : (
              <ScrollArea.Autosize mah={360}>
                <Stack gap={2}>
                  {equipmentDetail.sources.map((source) => (
                    <UnstyledButton
                      key={source.junkName}
                      className="wizda-row-hover"
                      onClick={() => setJunkDetail(
                        junkByName.get(source.junkName)
                        ?? { name: source.junkName, hasMultiplePools: false, maxDropQuality: null, maxDropGrade: null },
                      )}
                      p="xs"
                      style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="sm">
                        <TruncatedText size="sm">{source.junkName}</TruncatedText>
                        <IconChevronRight size={14} opacity={0.5} style={{ flexShrink: 0 }} />
                      </Group>
                    </UnstyledButton>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Stack>
        )}
      </Modal>

      {/* Junk detail */}
      <Modal
        opened={Boolean(junkDetail)}
        onClose={() => setJunkDetail(null)}
        title="Junk details"
        centered
        size="lg"
      >
        {junkDetail && (
          <Stack gap="sm">
            <Text fw={600} fz="lg">{junkDetail.name}</Text>
            {junkDetail.hasMultiplePools && (
              <Alert color="yellow" variant="light" icon={<IconInfoCircle />}>
                {MULTI_POOL_NOTE}
              </Alert>
            )}
            {(junkDetail.maxDropQuality || junkDetail.maxDropGrade) && (
              <Group gap="lg">
                <Text c="dimmed" size="sm">Best it drops</Text>
                {junkDetail.maxDropQuality && <QualityStars value={junkDetail.maxDropQuality} />}
                {junkDetail.maxDropGrade && <GradeBadge value={junkDetail.maxDropGrade} />}
              </Group>
            )}
            <Divider label={`Drops ${junkDrops.length} piece${junkDrops.length === 1 ? '' : 's'} of gear`} />
            {junkDrops.length === 0 ? (
              <Text c="dimmed" size="sm">No droppable gear on record.</Text>
            ) : (
              <ScrollArea.Autosize mah={360}>
                <Stack gap={2}>
                  {junkDrops.map((piece) => (
                    <UnstyledButton
                      key={piece.name}
                      className="wizda-row-hover"
                      onClick={() => setEquipmentDetail(piece)}
                      p="xs"
                      style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="sm">
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <CategoryIcon size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                          <TruncatedText size="sm">{piece.name}</TruncatedText>
                        </Group>
                        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                          {piece.maxDropQuality && <QualityStars value={piece.maxDropQuality} size={11} />}
                          {piece.maxDropGrade && <GradeBadge value={piece.maxDropGrade} />}
                        </Group>
                      </Group>
                    </UnstyledButton>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Stack>
        )}
      </Modal>
    </DetailContext.Provider>
  );
}
