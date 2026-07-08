'use client';

import { useState } from 'react';

import {
    Badge, Button, CheckIcon, Combobox, Group, Pill, PillsInput, Stack, Text, useCombobox
} from '@mantine/core';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

import { CategoryIcon } from '@/components/CategoryIcon';
import { useSelectOnFocus } from '@/hooks/useSelectOnFocus';

interface EquipmentSelectProps {
  data: EquipmentListItem[],
  value: string[],
  onChange: (value: string[]) => void,
  disabled?: boolean,
}

const OPTION_LIMIT = 50;

/**
 * Multi-select equipment picker built on Combobox so we can (a) match loosely —
 * every whitespace-separated term must appear somewhere in the name, in any
 * order, so "silver axe" and "axe silver" both find "Silver Two-Handed Axe" —
 * and (b) give the dropdown a full-width close button (with an Esc hint), since
 * it isn't obvious how to dismiss the menu after picking.
 */
export function EquipmentSelect({
  data,
  value,
  onChange,
  disabled,
}: EquipmentSelectProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });
  const [search, setSearch] = useState('');
  const { ref: searchRef, selectOnFocus: selectSearch } = useSelectOnFocus<HTMLInputElement>();

  const selected = new Set(value);

  const toggle = (name: string) => {
    onChange(selected.has(name) ? value.filter((entry) => entry !== name) : [...value, name]);
    // Re-select the search so keyboard users can immediately type their next query.
    selectSearch();
  };
  const remove = (name: string) => {
    onChange(value.filter((entry) => entry !== name));
    selectSearch();
  };

  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = data
    .filter((item) => {
      const name = item.name.toLowerCase();
      return terms.every((term) => name.includes(term));
    })
    .slice(0, OPTION_LIMIT);

  const options = matches.map((item) => (
    <Combobox.Option value={item.name} key={item.name} active={selected.has(item.name)}>
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {selected.has(item.name) && <CheckIcon size={12} />}
          {/* Neutral placeholder icon until the item→category mapping is seeded. */}
          <CategoryIcon size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
          <Text size="sm" truncate>{item.name}</Text>
        </Group>
        {item.tier && (
          <Badge size="xs" variant="light" color="gray">{item.tier}</Badge>
        )}
      </Group>
    </Combobox.Option>
  ));

  const pills = value.map((name) => (
    <Pill key={name} withRemoveButton onRemove={() => remove(name)}>
      <Group
        gap={4}
        wrap="nowrap"
        component="span"
        style={{ display: 'inline-flex', verticalAlign: 'middle' }}
      >
        <CategoryIcon size={11} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        <span>{name}</span>
      </Group>
    </Pill>
  ));

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={toggle}
      disabled={disabled}
      withinPortal={false}
    >
      <Combobox.DropdownTarget>
        <PillsInput onClick={() => combobox.openDropdown()} disabled={disabled}>
          <Pill.Group>
            {pills}
            <Combobox.EventsTarget>
              <PillsInput.Field
                ref={searchRef}
                value={search}
                placeholder={value.length ? 'Add more gear…' : 'Search equipment'}
                disabled={disabled}
                onFocus={() => {
                  combobox.openDropdown();
                  // Select on focus-transition (not every click) so re-clicks can
                  // still position the caret and never clobber a manual selection.
                  selectSearch();
                }}
                onBlur={() => combobox.closeDropdown()}
                onChange={(event) => {
                  combobox.openDropdown();
                  combobox.updateSelectedOptionIndex();
                  setSearch(event.currentTarget.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Backspace' && search.length === 0 && value.length) {
                    event.preventDefault();
                    remove(value[value.length - 1]!);
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options mah={260} style={{ overflowY: 'auto' }}>
          {options.length
            ? options
            : <Combobox.Empty>No gear by that name</Combobox.Empty>}
        </Combobox.Options>
        <Combobox.Footer>
          <Button
            fullWidth
            variant="subtle"
            color="gray"
            size="sm"
            // onMouseDown so we act before the field's onBlur races us.
            onMouseDown={(event) => {
              event.preventDefault();
              combobox.closeDropdown();
            }}
          >
            <Stack gap={0} align="center">
              <span>Close</span>
              <Text size="xs" c="dimmed">Esc</Text>
            </Stack>
          </Button>
        </Combobox.Footer>
      </Combobox.Dropdown>
    </Combobox>
  );
}
