'use client';

import { WizdaEmoji } from '@/mascot/wizda';
import { ActionIcon, Anchor, Group, Input, Modal, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconInfoCircle } from '@tabler/icons-react';

interface FilterFieldProps {
  label: string,
  /** Plain-language explanation shown in the info (ⓘ) modal. */
  description: string,
  /** The control itself. */
  children: React.ReactNode,
  /**
   * The field's current value, shown beside its name. For a control that can't
   * state its own value at a glance — a slider's thumb sits at a position, not a
   * number — rather than for one whose value *is* what it draws (a chip, a pill).
   */
  readout?: React.ReactNode,
  /** Called to clear the field. Omit to hide the clear button entirely. */
  onClear?: () => void,
  /** Whether the clear button is shown (i.e. the field has something to clear). */
  canClear?: boolean,
}

/**
 * Shared layout for one Oracle filter: the label with an info (ⓘ) button that
 * opens a description modal and the field's current value, the control, and a
 * clear button parked to the *right of the control* (out of the way of the info
 * icon, and aligned across every field).
 */
export function FilterField({
  label,
  description,
  children,
  readout,
  onClear,
  canClear = false,
}: FilterFieldProps) {
  const [infoOpened, info] = useDisclosure(false);

  return (
    <Input.Wrapper
      label={(
        <Group justify="space-between" wrap="nowrap" component="span" w="100%">
          {/* Two groupings, not one run of three: the name (and the ⓘ that explains
              it) sit tight together, while the value stands apart from both. */}
          <Group gap="sm" wrap="nowrap" component="span">
            <Group gap={4} wrap="nowrap" component="span">
              <span>{label}</span>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                radius="xl"
                aria-label={`What is ${label}?`}
                onClick={info.open}
              >
                <IconInfoCircle size={15} />
              </ActionIcon>
            </Group>
            {readout}
          </Group>
          {onClear && canClear && (
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="dimmed"
              aria-label={`Clear ${label}`}
              onClick={onClear}
            >
              Clear
            </Anchor>
          )}
        </Group>
      )}
      styles={{ label: { width: '100%' } }}
    >
      <div style={{ marginTop: 6 }}>{children}</div>

      <Modal
        opened={infoOpened}
        onClose={info.close}
        title={label}
        size="md"
        centered
      >
        <Text className="wizda-speech">{WizdaEmoji.info} {description}</Text>
      </Modal>
    </Input.Wrapper>
  );
}
