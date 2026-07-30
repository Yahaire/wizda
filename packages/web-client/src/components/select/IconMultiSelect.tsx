'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useSelectOnFocus } from '@/hooks/useSelectOnFocus';
import { createSearchMatcher, normalize } from '@/utils/search';
import {
    Button, CheckIcon, Combobox, Group, Pill, PillsInput, Stack, Text, useVirtualizedCombobox
} from '@mantine/core';
import { useId } from '@mantine/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { IconComponent } from '@/components/icons/iconComponent';
import type { ComboboxStore } from '@mantine/core';

import type { ReactNode } from 'react';

export interface IconMultiSelectIcon {
  icon: IconComponent,
  /** Defaults to a dimmed neutral colour when omitted. */
  color?: string,
  /** Extra class for the glyph, e.g. the rank legibility rim (`.wizda-icon-outline`). */
  className?: string,
}

export interface IconMultiSelectGrouping<T> {
  /** Group label for an item, e.g. its rank or category type name. */
  getGroup: (item: T) => string,
  /**
   * Group display order, top to bottom, keyed by the label {@link getGroup}
   * returns. Keep this stable (`useMemo`) — it re-buckets the whole list.
   */
  order: readonly string[],
}

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
  getIcon?: (item: T) => IconMultiSelectIcon,
  /**
   * Whether an option can't be picked because it fits none of the other filters.
   * Never consulted for an already-selected item — the player must always be able
   * to take a pick back, and taking one back is what un-disables the rest.
   */
  isUnavailable?: (item: T) => boolean,
  /** Explains the greyed-out options, shown in the dropdown footer while any is. */
  unavailableHint?: string,
  /** Groups dropdown options (e.g. by rank or type) instead of a flat list. */
  grouping?: IconMultiSelectGrouping<T>,
  /** Shown when nothing is selected yet. */
  placeholder?: string,
  /** Shown once at least one item is selected. Defaults to {@link placeholder}. */
  selectedPlaceholder?: string,
  emptyMessage?: string,
  disabled?: boolean,
}

/** Visible height of the options list. Rows past it are scrolled to, not truncated. */
const LIST_MAX_HEIGHT = 260;

// Starting guesses only — every row reports its real height back through
// `measureElement`, so these just need to be close enough that the first paint
// doesn't jump. Both derive from Mantine's `--combobox-option-padding-sm`
// (6px 10px) over an `sm` line; the group label rides the same padding at 0.85em.
const OPTION_ROW_ESTIMATE = 33;
const GROUP_ROW_ESTIMATE = 30;

/**
 * A rendered line in the dropdown. Group headers share the index space with
 * options because the virtualizer measures *rows*, while the combobox store
 * counts *options* — see {@link buildRows} for the two-index-space bookkeeping.
 */
type Row<T> =
  | { kind: 'group', label: string, key: string }
  | { kind: 'option', item: T, label: string, group?: string, optionIndex: number, key: string };

interface RowModel<T> {
  rows: Row<T>[],
  /** Items in option-index order — what the combobox store navigates. */
  options: T[],
  /** Row index for each option index, so keyboard selection can scroll to it. */
  rowIndexByOption: number[],
}

/**
 * Flattens matches into the dropdown's display order, assigning each option both
 * a row index (its line, headers included) and an option index (its position
 * among selectable things, headers excluded). Mantine's virtualized combobox
 * navigates the latter; `@tanstack/react-virtual` renders the former.
 */
function buildRows<T>(
  matches: readonly T[],
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
  grouping: IconMultiSelectGrouping<T> | undefined,
): RowModel<T> {
  const rows: Row<T>[] = [];
  const options: T[] = [];
  const rowIndexByOption: number[] = [];

  const pushOption = (item: T, group?: string) => {
    rowIndexByOption.push(rows.length);
    rows.push({
      kind: 'option',
      item,
      label: getLabel(item),
      group,
      optionIndex: options.length,
      key: getValue(item),
    });
    options.push(item);
  };

  if (!grouping) {
    for (const item of matches) {
      pushOption(item);
    }
    return { rows, options, rowIndexByOption };
  }

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
  for (const group of grouping.order) {
    const items = byGroup.get(group);
    if (!items?.length) {
      continue;
    }
    rows.push({ kind: 'group', label: group, key: `group:${group}` });
    for (const item of items) {
      pushOption(item, group);
    }
  }
  return { rows, options, rowIndexByOption };
}

/**
 * Multi-select built on Combobox so we can (a) match loosely — every
 * whitespace-separated search term must appear somewhere in the label, in any
 * order and under aliasing, so "silver axe", "axe silver" and "2h silver axe"
 * all find "Silver Two-Handed Axe" (see `createSearchMatcher`) —
 * (b) show an optionally colour-tinted icon on each pill and option, and (c)
 * optionally group dropdown options (e.g. by rank). Also gives the dropdown a
 * full-width close button (with an Esc hint), since it isn't obvious how to
 * dismiss the menu after picking.
 *
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
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const optionIdBase = useId();

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

  // On touch devices the virtual keyboard covers the lower screen, leaving the
  // inline dropdown (rendered right below the field) no room to open into — it
  // clips or flips into the equally-cramped space above. Nudge the field up
  // toward the header on focus so the menu opens into the space above the
  // keyboard. Pointer-, not width-gated: only a real touch keyboard steals the
  // room. No-op on desktop, where an unbidden page jump would just be jarring.
  const scrollFieldToTopOnTouch = () => {
    if (!window.matchMedia('(pointer: coarse)').matches) {
      return;
    }
    requestAnimationFrame(() => {
      searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Item text never changes between keystrokes, only the query does — so fold it
  // once rather than re-normalizing the whole catalog on every character. This
  // whole block used to run bare in the render body, so it also re-ran on renders
  // that had nothing to do with searching.
  const haystacks = useMemo(
    () => data.map((item) => ({
      item,
      texts: (getSearchTexts?.(item) ?? [getLabel(item)])
        .filter((text): text is string => Boolean(text))
        .map(normalize),
    })),
    [data, getSearchTexts, getLabel],
  );

  const matches = useMemo(() => {
    const matcher = createSearchMatcher(debouncedSearch);
    return haystacks
      .filter((entry) => matcher.matchesNormalized(entry.texts))
      .map((entry) => entry.item);
  }, [haystacks, debouncedSearch]);

  const unavailable = (item: T) => (
    Boolean(isUnavailable?.(item)) && !selected.has(getValue(item))
  );
  const showUnavailableHint = Boolean(unavailableHint) && matches.some(unavailable);

  const groupingGetGroup = grouping?.getGroup;
  const groupingOrder = grouping?.order;
  const { rows, options, rowIndexByOption } = useMemo(
    () => buildRows(
      matches,
      getValue,
      getLabel,
      groupingGetGroup && groupingOrder
        ? { getGroup: groupingGetGroup, order: groupingOrder }
        : undefined,
    ),
    [matches, getValue, getLabel, groupingGetGroup, groupingOrder],
  );

  const getOptionId = (index: number) => `${optionIdBase}-option-${index}`;

  const store = useVirtualizedCombobox({
    totalOptionsCount: options.length,
    getOptionId,
    selectedOptionIndex,
    setSelectedOptionIndex,
    isOptionDisabled: (index) => {
      const item = options[index];
      return !item || unavailable(item);
    },
    onSelectedOptionSubmit: (index) => {
      const item = options[index];
      if (item) {
        toggle(getValue(item));
      }
    },
    onDropdownClose: () => setSelectedOptionIndex(-1),
  });

  // Mantine v8's virtualized store builds `getSelectedOptionIndex` as
  // `useCallback(() => selectedOptionIndex, [])` over a *prop*, so it answers
  // with the index from the very first render — a permanent -1 — and the target's
  // Enter handler (which bails on -1) would never submit. The non-virtualized
  // store reads a ref there, which is why only this path needs the patch.
  const combobox: ComboboxStore = {
    ...store,
    getSelectedOptionIndex: () => selectedOptionIndex,
  };

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (
      rows[index]?.kind === 'group' ? GROUP_ROW_ESTIMATE : OPTION_ROW_ESTIMATE
    ),
    overscan: 8,
  });

  // Keep the keyboard cursor on screen. No dependency array: the guard below is
  // the real trigger, and the honest deps (`rowIndexByOption`, `virtualizer`)
  // change identity every render, which would scroll on renders the player
  // didn't ask for — including while they drag the scrollbar.
  const lastScrolledIndex = useRef(-1);
  useEffect(() => {
    if (selectedOptionIndex === lastScrolledIndex.current) {
      return;
    }
    lastScrolledIndex.current = selectedOptionIndex;
    const rowIndex = rowIndexByOption[selectedOptionIndex];
    if (rowIndex !== undefined) {
      virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }
  });

  const renderRow = (rowIndex: number, offset: number): ReactNode => {
    const row = rows[rowIndex]!;
    const position = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      transform: `translateY(${offset}px)`,
    } as const;

    if (row.kind === 'group') {
      return (
        <div
          key={row.key}
          data-index={rowIndex}
          ref={virtualizer.measureElement}
          style={position}
          // Presentational: a virtualized listbox can't hold real `role="group"`
          // semantics, because only the mounted window is in the DOM and the
          // grouping would lie about what it contains. The group name reaches
          // assistive tech through each option's `aria-label` instead.
          aria-hidden="true"
          className="wizda-select-group-label"
        >
          {row.label}
        </div>
      );
    }

    const itemValue = getValue(row.item);
    const iconInfo = getIcon?.(row.item);
    return (
      <div key={row.key} data-index={rowIndex} ref={virtualizer.measureElement} style={position}>
        <Combobox.Option
          value={itemValue}
          id={getOptionId(row.optionIndex)}
          active={selected.has(itemValue)}
          selected={row.optionIndex === selectedOptionIndex}
          disabled={unavailable(row.item)}
          // The visible label already reads the item's name; the group only needs
          // spelling out because its header row is presentational (see above).
          aria-label={row.group ? `${row.label}, ${row.group}` : undefined}
        >
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            {selected.has(itemValue) && <CheckIcon size={12} />}
            {iconInfo && (
              <iconInfo.icon
                size={14}
                color={iconInfo.color ?? 'var(--mantine-color-dimmed)'}
                className={iconInfo.className}
                style={{ flexShrink: 0 }}
              />
            )}
            <Text size="sm" truncate>{row.label}</Text>
          </Group>
        </Combobox.Option>
      </div>
    );
  };

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
                  scrollFieldToTopOnTouch();
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
        <Combobox.Options ref={scrollRef} mah={LIST_MAX_HEIGHT} style={{ overflowY: 'auto' }}>
          {rows.length === 0
            ? <Combobox.Empty>{emptyMessage}</Combobox.Empty>
            : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {virtualizer.getVirtualItems().map(
                  (virtualRow) => renderRow(virtualRow.index, virtualRow.start),
                )}
              </div>
            )}
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
              <Text size="xs" c="dimmed" className="wizda-hide-on-touch">Esc</Text>
            </Stack>
          </Button>
        </Combobox.Footer>
      </Combobox.Dropdown>
    </Combobox>
  );
}
