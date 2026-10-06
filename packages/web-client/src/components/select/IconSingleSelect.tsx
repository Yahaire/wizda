'use client';

import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { Combobox, Group, Input, InputBase, Text } from '@mantine/core';

import { OptionList, scrollFieldToTopOnTouch, useOptionRows, useOptionStore } from './selectOptions';

import type { SelectGrouping, SelectOptionIcon } from './selectOptions';

interface IconSingleSelectProps<T> {
  data: readonly T[],
  /** The picked item's value, or null for nothing picked yet. */
  value: string | null,
  onChange: (value: string) => void,
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
  /**
   * Every text an item can be matched on, when that's more than its label —
   * typically the label plus, in Japanese, the reading the API sends alongside
   * it. Only consulted while {@link searchable}. Nullish entries are dropped.
   *
   * Keep this stable (`useCallback`, or a module-level function): each item's
   * text is folded once and cached against its identity.
   */
  getSearchTexts?: (item: T) => readonly (string | null | undefined)[],
  /** Icon shown on the target and on each dropdown option. Omit to show no icon. */
  getIcon?: (item: T) => SelectOptionIcon,
  /**
   * Whether an option can't be picked because it fits none of the other filters.
   * Never consulted for the already-picked item — the player must always be able
   * to see what they chose.
   */
  isUnavailable?: (item: T) => boolean,
  /** Explains the greyed-out options, shown in the dropdown footer while any is. */
  unavailableHint?: string,
  /** Groups dropdown options (e.g. by rank or type) instead of a flat list. */
  grouping?: SelectGrouping<T>,
  /**
   * Adds a search field at the top of the dropdown. Worth it for a long list
   * (the equipment catalogue); noise for the handful of static options a
   * quality or grade field offers, so it's off by default.
   */
  searchable?: boolean,
  /** Placeholder for the in-dropdown search field. Only used while {@link searchable}. */
  searchPlaceholder?: string,
  /** Shown in the target while nothing is picked. */
  placeholder?: string,
  emptyMessage?: string,
  disabled?: boolean,
  /** Labels the control for assistive tech, since the target renders no text of its own when empty. */
  ariaLabel?: string,
}

/**
 * Single-select over the same dropdown as {@link IconMultiSelect} — same loose
 * matching, tinted icons, grouping, and Close/Esc footer — with a target that
 * shows the one current value instead of a pills input.
 *
 * A separate component rather than a `single` flag on the multi-select because
 * the two share their menu and share nothing else: pills, an inline search
 * field, and Backspace-removes-last are all meaningless here, while "the whole
 * field is one button that opens the menu" is meaningless there. Squeezing both
 * into one component meant a placeholder that read as a search prompt sitting
 * next to a value that couldn't fill its own field.
 *
 * Where the multi-select puts its search inline among the pills, this one puts
 * it inside the dropdown ({@link searchable}) — the target has a value to show
 * and no room to also be a text field.
 */
export function IconSingleSelect<T>({
  data,
  value,
  onChange,
  getValue,
  getLabel,
  getSearchTexts,
  getIcon,
  isUnavailable,
  unavailableHint,
  grouping,
  searchable = false,
  searchPlaceholder,
  placeholder,
  emptyMessage = 'No matches',
  disabled,
  ariaLabel,
}: IconSingleSelectProps<T>) {
  const { value: search, setValue: setSearch, debounced: debouncedSearch, compositionProps } =
    useDebouncedSearch();

  const isSelected = (item: T) => getValue(item) === value;
  const isDisabled = (item: T) => Boolean(isUnavailable?.(item)) && !isSelected(item);

  const rowModel = useOptionRows({
    data,
    getValue,
    getLabel,
    getSearchTexts,
    grouping,
    // Without a search field the whole list always shows, and the stale query a
    // previous `searchable` render left behind must not filter it.
    search: searchable ? debouncedSearch : '',
  });

  const select = (itemValue: string) => {
    onChange(itemValue);
    combobox.closeDropdown();
    // Focus belongs back on the target: it's the only thing left to interact
    // with, and leaving focus in a closed dropdown strands keyboard users.
    combobox.focusTarget();
  };

  const store = useOptionStore({
    options: rowModel.options,
    isDisabled,
    onSubmit: (item) => select(getValue(item)),
    // A query outlives its dropdown otherwise, so reopening the field would show
    // it still filtered by a search the player can no longer see.
    onDropdownClose: () => setSearch(''),
  });
  const { combobox, setSelectedOptionIndex } = store;

  const picked = data.find((item) => getValue(item) === value);
  const pickedIcon = picked && getIcon ? getIcon(picked) : undefined;

  const toggleDropdown = () => {
    const opening = !combobox.dropdownOpened;
    combobox.toggleDropdown();
    if (!opening || !searchable) {
      return;
    }
    combobox.focusSearchInput();
    scrollFieldToTopOnTouch(combobox.targetRef.current);
  };

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={select}
      disabled={disabled}
      withinPortal={false}
    >
      <Combobox.Target>
        {/* A button, so a click anywhere in the field — label, icon, padding —
            opens the menu, and the picked value fills the field rather than
            sitting in it as a pill. */}
        <InputBase
          component="button"
          type="button"
          pointer
          disabled={disabled}
          aria-label={ariaLabel}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          onClick={toggleDropdown}
        >
          {picked
            ? (
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                {pickedIcon && (
                  <pickedIcon.icon
                    size={14}
                    color={pickedIcon.color ?? 'var(--mantine-color-dimmed)'}
                    className={pickedIcon.className}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <Text size="sm" truncate>{getLabel(picked)}</Text>
              </Group>
            )
            : <Input.Placeholder>{placeholder}</Input.Placeholder>}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        {searchable && (
          <Combobox.Search
            className="wizda-scroll-clear-header"
            value={search}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              // Option indices are positional, so the old cursor would point at
              // an unrelated item once the match set shifts under it.
              setSelectedOptionIndex(-1);
              setSearch(event.currentTarget.value);
            }}
            {...compositionProps}
          />
        )}
        <OptionList
          rowModel={rowModel}
          store={store}
          getValue={getValue}
          getIcon={getIcon}
          isSelected={isSelected}
          isDisabled={isDisabled}
          emptyMessage={emptyMessage}
          unavailableHint={unavailableHint}
        />
      </Combobox.Dropdown>
    </Combobox>
  );
}
