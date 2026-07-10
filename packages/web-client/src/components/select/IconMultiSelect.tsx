'use client';

import { useState } from 'react';

import { useSelectOnFocus } from '@/hooks/useSelectOnFocus';
import { createSearchMatcher } from '@/utils/search';
import {
    Button, CheckIcon, Combobox, Group, Pill, PillsInput, Stack, Text, useCombobox
} from '@mantine/core';

import type { IconProps } from '@tabler/icons-react';

import type { ComponentType, ReactNode } from 'react';

export interface IconMultiSelectIcon {
  icon: ComponentType<IconProps>,
  /** Defaults to a dimmed neutral colour when omitted. */
  color?: string,
}

export interface IconMultiSelectGrouping<T> {
  /** Group label for an item, e.g. its tier or category type name. */
  getGroup: (item: T) => string,
  /** Group display order, top to bottom, keyed by the label {@link getGroup} returns. */
  order: string[],
  /** Max matches shown per group. Omit for no cap. */
  cap?: number,
}

interface IconMultiSelectProps<T> {
  data: readonly T[],
  value: string[],
  onChange: (value: string[]) => void,
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
  /** Icon shown on each pill and dropdown option. Omit to show no icon. */
  getIcon?: (item: T) => IconMultiSelectIcon,
  /**
   * Whether an option can't be picked because it fits none of the other filters.
   * Never consulted for an already-selected item — the player must always be able
   * to take a pick back, and taking one back is what un-disables the rest.
   */
  isUnavailable?: (item: T) => boolean,
  /** Explains the greyed-out options, shown in the dropdown footer while any is. */
  unavailableHint?: string,
  /** Groups dropdown options (e.g. by tier or type) instead of a flat list. */
  grouping?: IconMultiSelectGrouping<T>,
  /** Match cap when {@link grouping} isn't set. */
  optionLimit?: number,
  /** Shown when nothing is selected yet. */
  placeholder?: string,
  /** Shown once at least one item is selected. Defaults to {@link placeholder}. */
  selectedPlaceholder?: string,
  emptyMessage?: string,
  disabled?: boolean,
}

const DEFAULT_OPTION_LIMIT = 50;

/**
 * Multi-select built on Combobox so we can (a) match loosely — every
 * whitespace-separated search term must appear somewhere in the label, in any
 * order and under aliasing, so "silver axe", "axe silver" and "2h silver axe"
 * all find "Silver Two-Handed Axe" (see `createSearchMatcher`) —
 * (b) show an optionally colour-tinted icon on each pill and option, and (c)
 * optionally group dropdown options (e.g. by tier), each with its own match
 * cap so a broad search doesn't bury one group under another. Also gives the
 * dropdown a full-width close button (with an Esc hint), since it isn't
 * obvious how to dismiss the menu after picking.
 */
export function IconMultiSelect<T>({
  data,
  value,
  onChange,
  getValue,
  getLabel,
  getIcon,
  isUnavailable,
  unavailableHint,
  grouping,
  optionLimit = DEFAULT_OPTION_LIMIT,
  placeholder = 'Search…',
  selectedPlaceholder,
  emptyMessage = 'No matches',
  disabled,
}: IconMultiSelectProps<T>) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });
  const [search, setSearch] = useState('');
  const { ref: searchRef, selectOnFocus: selectSearch } = useSelectOnFocus<HTMLInputElement>();

  const selected = new Set(value);
  const byValue = new Map(data.map((item) => [getValue(item), item]));

  const toggle = (itemValue: string) => {
    onChange(selected.has(itemValue) ? value.filter((entry) => entry !== itemValue) : [...value, itemValue]);
    // Re-select the search so keyboard users can immediately type their next query.
    selectSearch();
  };
  const remove = (itemValue: string) => {
    onChange(value.filter((entry) => entry !== itemValue));
    selectSearch();
  };

  const matchesSearch = createSearchMatcher(search);
  const matches = data.filter((item) => matchesSearch(getLabel(item)));

  const unavailable = (item: T) => (
    Boolean(isUnavailable?.(item)) && !selected.has(getValue(item))
  );
  const showUnavailableHint = Boolean(unavailableHint) && matches.some(unavailable);

  const renderOption = (item: T) => {
    const itemValue = getValue(item);
    const iconInfo = getIcon?.(item);
    return (
      <Combobox.Option
        value={itemValue}
        key={itemValue}
        active={selected.has(itemValue)}
        disabled={unavailable(item)}
      >
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {selected.has(itemValue) && <CheckIcon size={12} />}
          {iconInfo && (
            <iconInfo.icon
              size={14}
              color={iconInfo.color ?? 'var(--mantine-color-dimmed)'}
              style={{ flexShrink: 0 }}
            />
          )}
          <Text size="sm" truncate>{getLabel(item)}</Text>
        </Group>
      </Combobox.Option>
    );
  };

  let optionsContent: ReactNode;
  if (grouping) {
    const byGroup = new Map<string, T[]>();
    for (const item of matches) {
      const group = grouping.getGroup(item);
      const list = byGroup.get(group);
      if (list) {
        list.push(item);
      } else {
        byGroup.set(group, [item]);
      }
    }
    const groups = grouping.order
      .map((group) => ({ group, items: byGroup.get(group) ?? [] }))
      .filter((entry) => entry.items.length > 0);

    optionsContent = groups.length
      ? groups.map(({ group, items }) => (
        <Combobox.Group label={group} key={group}>
          {items.slice(0, grouping.cap ?? items.length).map(renderOption)}
        </Combobox.Group>
      ))
      : <Combobox.Empty>{emptyMessage}</Combobox.Empty>;
  } else {
    const capped = matches.slice(0, optionLimit);
    optionsContent = capped.length
      ? capped.map(renderOption)
      : <Combobox.Empty>{emptyMessage}</Combobox.Empty>;
  }

  const pills = value.map((itemValue) => {
    const item = byValue.get(itemValue);
    const iconInfo = item && getIcon ? getIcon(item) : undefined;
    return (
      <Pill key={itemValue} withRemoveButton onRemove={() => remove(itemValue)}>
        <Group
          gap={4}
          wrap="nowrap"
          component="span"
          style={{ display: 'inline-flex', verticalAlign: 'baseline' }}
        >
          {iconInfo && (
            <iconInfo.icon
              size={11}
              color={iconInfo.color ?? 'var(--mantine-color-dimmed)'}
              style={{ flexShrink: 0 }}
            />
          )}
          <span>{item ? getLabel(item) : itemValue}</span>
        </Group>
      </Pill>
    );
  });

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
                placeholder={value.length ? (selectedPlaceholder ?? placeholder) : placeholder}
                disabled={disabled}
                onFocus={() => {
                  // Re-activating the window refocuses this field with the menu
                  // still up (see onBlur). That focus isn't the player's doing, so
                  // don't answer it — `selectSearch` would yank focus back off the
                  // control they clicked, a frame after they clicked it.
                  if (combobox.dropdownOpened) {
                    return;
                  }
                  combobox.openDropdown();
                  // Select on focus-transition (not every click) so re-clicks can
                  // still position the caret and never clobber a manual selection.
                  selectSearch();
                }}
                // Losing the window is not losing the field. Closing here would
                // reopen on the way back — the restored focus fires before the
                // click that restored it lands — so the menu would redraw under
                // the cursor and swallow a click meant for a control behind it.
                onBlur={() => {
                  if (document.hasFocus()) {
                    combobox.closeDropdown();
                  }
                }}
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
          {optionsContent}
        </Combobox.Options>
        <Combobox.Footer>
          {showUnavailableHint && (
            <Text size="xs" c="dimmed" ta="center" pb={4}>{unavailableHint}</Text>
          )}
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
