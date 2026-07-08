'use client';

import {
  Button,
  Chip,
  Group,
  Modal,
  Pill,
  SimpleGrid,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSparkles } from '@tabler/icons-react';

import { BLESSINGS } from '@shared/domain/stats';

import {
  blessingLabel,
  MAX_BLESSINGS,
} from './oracle.logic';

interface BlessingsFilterProps {
  value: string[],
  onChange: (value: string[]) => void,
}

/**
 * Required-blessing picker. A button opens a small modal of toggle chips (there
 * are only 19), and the chosen blessings show as removable pills. AND semantics
 * — the item must carry all selected blessings — so we cap at {@link MAX_BLESSINGS}
 * (no piece holds more). Label/clear/info are provided by the wrapping FilterField.
 */
export function BlessingsFilter({ value, onChange }: BlessingsFilterProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const atCap = value.length >= MAX_BLESSINGS;

  const toggle = (next: string[]) => {
    if (next.length <= MAX_BLESSINGS) {
      onChange(next);
    }
  };

  return (
    <div>
      <Button
        variant="light"
        color="crimson"
        leftSection={<IconSparkles size={16} />}
        onClick={open}
      >
        {value.length ? `Blessings (${value.length})` : 'Choose blessings'}
      </Button>

      {value.length > 0 && (
        <Group gap={6} mt={8}>
          {value.map((code) => (
            <Pill
              key={code}
              withRemoveButton
              onRemove={() => onChange(value.filter((entry) => entry !== code))}
            >
              {blessingLabel(code)}
            </Pill>
          ))}
        </Group>
      )}

      <Modal
        opened={opened}
        onClose={close}
        title="Required blessings"
        size="md"
        centered
      >
        <Text className="wizda-speech" size="sm" mb="sm">
          Pick every blessing the item must carry — I&apos;ll only count pieces that
          have all of them.
        </Text>
        <Chip.Group multiple value={value} onChange={toggle}>
          <SimpleGrid cols={{ base: 3, xs: 4 }} spacing="xs" verticalSpacing="xs">
            {BLESSINGS.map((blessing) => (
              <Chip
                key={blessing.code}
                value={blessing.code}
                color="crimson"
                variant="outline"
                size="sm"
                disabled={atCap && !value.includes(blessing.code)}
                styles={{ iconWrapper: { display: 'none' } }}
              >
                {blessingLabel(blessing.code)}
              </Chip>
            ))}
          </SimpleGrid>
        </Chip.Group>
        {atCap && (
          <Text c="dimmed" size="xs" mt="sm">
            That&apos;s the most a single piece can hold ({MAX_BLESSINGS}).
          </Text>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="light" color="crimson" onClick={close}>Done</Button>
        </Group>
      </Modal>
    </div>
  );
}
