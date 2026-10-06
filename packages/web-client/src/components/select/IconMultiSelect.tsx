'use client';

import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useSelectOnFocus } from '@/hooks/useSelectOnFocus';
import { Combobox, Group, Pill, PillsInput } from '@mantine/core';

import {
    OptionList, scrollFieldToTopOnTouch, useOptionRows, useOptionStore
} from './selectOptions';

import type { SelectGrouping, SelectOptionIcon } from './selectOptions';

interface IconMultiSelectProps<T> {
  data: readonly T[],
  value: string[],
  onChange: (value: string[]) => void,
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
  /**
   * Every text an item can be matched on, when that's more than its label —
   * typically the label plus, in Japanese, the reading the API sends alongside
   * it. Defaults to the label alone. Nullish entries are dropped.
   *
   * Separate from {@link getLabel} because that also renders pills and options
   * and so can't carry search-only text. Keep this stable (`useCallback`): each
   * item's text is folded once and cached against its identity.
   */
  getSearchTexts?: (item: T) => readonly (string | null | undefined)[],
  /** Icon shown on each pill and dropdown option. Omit to show no icon. */
  getIcon?: (item: T) => SelectOptionIcon,
  /**
   * Whether an option can't be picked because it fits none of the other filters.
   * Never consulted for an already-selected item — the player must always be able
   * to take a pick back, and taking one back is what un-disables the rest.
   */
  isUnavailable?: (item: T) => boolean,
  /** Explains the greyed-out options, shown in the dropdown footer while any is. */
  unavailableHint?: string,
  /** Groups dropdown options (e.g. by rank or type) instead of a flat list. */
  grouping?: SelectGrouping<T>,
  /** Shown when nothing is selected yet. */
  placeholder?: string,
  /** Shown once at least one item is selected. Defaults to {@link placeholder}. */
  selectedPlaceholder?: string,
  emptyMessage?: string,
  disabled?: boolean,
}

/**
 * Multi-select built on Combobox so we can (a) match loosely — every
 * whitespace-separated search term must appear somewhere in the label, in any
 * order and under aliasing, so "silver axe", "axe silver" and "2h silver axe"
 * all find "Silver Two-Handed Axe" (see `createSearchMatcher`) —
 * (b) show an optionally colour-tinted icon on each pill and option, and (c)
 * optionally group dropdown options (e.g. by rank).
 *
 * The target is a pills input with the search field inline among the pills; the
 * menu below it comes from the shared {@link OptionList}. For a field that keeps
 * exactly one pick, use `IconSingleSelect` — same menu, a target that shows the
 * one value instead.
 */
export function IconMultiSelect<T>({
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
  placeholder = 'Search…',
  selectedPlaceholder,
  emptyMessage = 'No matches',
  disabled,
}: IconMultiSelectProps<T>) {
  const { value: search, setValue: setSearch, debounced: debouncedSearch, compositionProps } =
    useDebouncedSearch();
  const { ref: searchRef, selectOnFocus: selectSearch } = useSelectOnFocus<HTMLInputElement>();

  const selected = new Set(value);
  const byValue = new Map(data.map((item) => [getValue(item), item]));

  const isSelected = (item: T) => selected.has(getValue(item));
  const isDisabled = (item: T) => Boolean(isUnavailable?.(item)) && !isSelected(item);

  const rowModel = useOptionRows({
    data,
    getValue,
    getLabel,
    getSearchTexts,
    grouping,
    search: debouncedSearch,
  });

  const toggle = (itemValue: string) => {
    onChange(selected.has(itemValue) ? value.filter((entry) => entry !== itemValue) : [...value, itemValue]);
    // Re-select the search so keyboard users can immediately type their next query.
    selectSearch();
  };
  const remove = (itemValue: string) => {
    onChange(value.filter((entry) => entry !== itemValue));
    selectSearch();
  };

  const store = useOptionStore({
    options: rowModel.options,
    isDisabled,
    onSubmit: (item) => toggle(getValue(item)),
  });
  const { combobox, setSelectedOptionIndex } = store;

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
              className={iconInfo.className}
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
                className="wizda-scroll-clear-header"
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
                  scrollFieldToTopOnTouch(searchRef.current);
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
                  // Option indices are positional, so the old cursor would point
                  // at an unrelated item once the match set shifts under it.
                  setSelectedOptionIndex(-1);
                  setSearch(event.currentTarget.value);
                }}
                {...compositionProps}
                onKeyDown={(event) => {
                  // While an IME is composing, Backspace belongs to the IME —
                  // it edits the uncommitted reading, and must never reach back
                  // and delete a pill. Mantine already guards its own Enter and
                  // arrow handling this way (see use-combobox-target-props), but
                  // this handler runs before that, so it needs its own check.
                  if (event.nativeEvent.isComposing) {
                    return;
                  }
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
