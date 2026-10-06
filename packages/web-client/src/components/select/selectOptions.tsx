'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { createSearchMatcher, normalize } from '@/utils/search';
import { Button, CheckIcon, Combobox, Group, Stack, Text, useVirtualizedCombobox } from '@mantine/core';
import { useId } from '@mantine/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { IconComponent } from '@/components/icons/iconComponent';
import type { ComboboxStore } from '@mantine/core';

import type { ReactNode } from 'react';

/**
 * The dropdown half of this folder's selects, shared by `IconMultiSelect` and
 * `IconSingleSelect`.
 *
 * The two components differ entirely in their *target* — a pills input with an
 * inline search field versus a button showing one value — and not at all in
 * their menu: loose matching, tinted icons, optional grouping, greyed-out
 * options, keyboard navigation, and the Close/Esc footer are the same job in
 * both. That split is why they're two components over one shared menu rather
 * than one component with a `single` flag.
 */

export interface SelectOptionIcon {
  icon: IconComponent,
  /** Defaults to a dimmed neutral colour when omitted. */
  color?: string,
  /** Extra class for the glyph, e.g. the rank legibility rim (`.wizda-icon-outline`). */
  className?: string,
}

export interface SelectGrouping<T> {
  /** Group label for an item, e.g. its rank or category type name. */
  getGroup: (item: T) => string,
  /**
   * Group display order, top to bottom, keyed by the label {@link getGroup}
   * returns. Keep this stable (`useMemo`) — it re-buckets the whole list.
   */
  order: readonly string[],
}

/** Visible height of the options list. Rows past it are scrolled to, not truncated. */
const LIST_MAX_HEIGHT = 260;

/**
 * Row count past which the list is virtualized. Below it, every row is rendered
 * in normal flow instead.
 *
 * Virtualization exists for the equipment catalogue (738 rows) and earns nothing
 * on a handful of static options — while costing correctness: the virtualizer
 * sizes itself from its scroll container, and in a narrow column (the Enhancement
 * Oracle's quality/initial-grade fields, side by side in a two-column grid) it
 * can measure that container to zero on the frame the dropdown opens and render
 * no rows at all. A short list has nothing to gain from the mechanism that
 * breaks it, so it opts out.
 */
const VIRTUALIZATION_THRESHOLD = 60;

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
export type Row<T> =
  | { kind: 'group', label: string, key: string }
  | { kind: 'option', item: T, label: string, group?: string, optionIndex: number, key: string };

export interface RowModel<T> {
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
  grouping: SelectGrouping<T> | undefined,
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

interface UseOptionRowsParams<T> {
  data: readonly T[],
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
  getSearchTexts?: (item: T) => readonly (string | null | undefined)[],
  grouping?: SelectGrouping<T>,
  /** The (already debounced) query to filter on. Empty matches everything. */
  search: string,
}

/** Filters `data` by `search` and flattens the survivors into dropdown rows. */
export function useOptionRows<T>({
  data,
  getValue,
  getLabel,
  getSearchTexts,
  grouping,
  search,
}: UseOptionRowsParams<T>): RowModel<T> {
  // Item text never changes between keystrokes, only the query does — so fold it
  // once rather than re-normalizing the whole catalog on every character.
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
    const matcher = createSearchMatcher(search);
    return haystacks
      .filter((entry) => matcher.matchesNormalized(entry.texts))
      .map((entry) => entry.item);
  }, [haystacks, search]);

  const groupingGetGroup = grouping?.getGroup;
  const groupingOrder = grouping?.order;
  return useMemo(
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
}

interface UseOptionStoreParams<T> {
  options: readonly T[],
  /** Whether an option can't be picked, already accounting for selection. */
  isDisabled: (item: T) => boolean,
  /** Called when the keyboard cursor submits an option. */
  onSubmit: (item: T) => void,
  /** Extra teardown on close, e.g. clearing a search field the dropdown owns. */
  onDropdownClose?: () => void,
}

export interface OptionStore {
  combobox: ComboboxStore,
  selectedOptionIndex: number,
  setSelectedOptionIndex: (index: number) => void,
  getOptionId: (index: number) => string,
}

/** The Combobox store both selects drive, plus the keyboard-cursor state it reads. */
export function useOptionStore<T>({
  options,
  isDisabled,
  onSubmit,
  onDropdownClose,
}: UseOptionStoreParams<T>): OptionStore {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(-1);
  const optionIdBase = useId();
  const getOptionId = (index: number) => `${optionIdBase}-option-${index}`;

  const store = useVirtualizedCombobox({
    totalOptionsCount: options.length,
    getOptionId,
    selectedOptionIndex,
    setSelectedOptionIndex,
    isOptionDisabled: (index) => {
      const item = options[index];
      return !item || isDisabled(item);
    },
    onSelectedOptionSubmit: (index) => {
      const item = options[index];
      if (item) {
        onSubmit(item);
      }
    },
    onDropdownClose: () => {
      setSelectedOptionIndex(-1);
      onDropdownClose?.();
    },
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

  return {
    combobox,
    selectedOptionIndex,
    setSelectedOptionIndex,
    getOptionId,
  };
}

interface OptionListProps<T> {
  rowModel: RowModel<T>,
  store: OptionStore,
  getValue: (item: T) => string,
  getIcon?: (item: T) => SelectOptionIcon,
  /** Whether an item is currently picked — draws its check mark. */
  isSelected: (item: T) => boolean,
  /** Whether an item can't be picked, already accounting for selection. */
  isDisabled: (item: T) => boolean,
  emptyMessage: string,
  /** Explains the greyed-out options, shown in the footer while any is. */
  unavailableHint?: string,
}

/**
 * The dropdown's scrolling option list plus its Close footer — everything below
 * the target, for either select. Virtualizes only past
 * {@link VIRTUALIZATION_THRESHOLD} rows.
 *
 * Renders `Combobox.Options`/`Combobox.Footer` directly, so callers place it
 * inside their own `Combobox.Dropdown`.
 */
export function OptionList<T>({
  rowModel,
  store,
  getValue,
  getIcon,
  isSelected,
  isDisabled,
  emptyMessage,
  unavailableHint,
}: OptionListProps<T>) {
  const { rows, rowIndexByOption } = rowModel;
  const { combobox, selectedOptionIndex, getOptionId } = store;
  const scrollRef = useRef<HTMLDivElement>(null);

  const showUnavailableHint = Boolean(unavailableHint)
    && rows.some((row) => row.kind === 'option' && isDisabled(row.item));

  const isVirtualized = rows.length > VIRTUALIZATION_THRESHOLD;

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
  //
  // Virtualized only: an unvirtualized row is a real element the whole time, so
  // it scrolls itself into view from its own ref (see `renderRow`) rather than
  // being scrolled to by index.
  const lastScrolledIndex = useRef(-1);
  useEffect(() => {
    if (!isVirtualized || selectedOptionIndex === lastScrolledIndex.current) {
      return;
    }
    lastScrolledIndex.current = selectedOptionIndex;
    const rowIndex = rowIndexByOption[selectedOptionIndex];
    if (rowIndex !== undefined) {
      virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }
  });

  /** `offset` is the virtualizer's y-position; null renders the row in normal flow. */
  const renderRow = (rowIndex: number, offset: number | null): ReactNode => {
    const row = rows[rowIndex]!;
    const position = offset === null
      ? undefined
      : {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${offset}px)`,
      } as const;
    // Only the virtualizer needs rows to report their heights back.
    const measureRef = offset === null ? undefined : virtualizer.measureElement;

    if (row.kind === 'group') {
      return (
        <div
          key={row.key}
          data-index={rowIndex}
          ref={measureRef}
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
    // Unvirtualized, the keyboard cursor keeps itself on screen: `'nearest'` is a
    // no-op once the row is already visible, so re-running it per render is free.
    const rowRef = offset !== null
      ? measureRef
      : (node: HTMLDivElement | null) => {
        if (node && row.optionIndex === selectedOptionIndex) {
          node.scrollIntoView({ block: 'nearest' });
        }
      };
    return (
      <div key={row.key} data-index={rowIndex} ref={rowRef} style={position}>
        <Combobox.Option
          value={itemValue}
          id={getOptionId(row.optionIndex)}
          active={isSelected(row.item)}
          selected={row.optionIndex === selectedOptionIndex}
          disabled={isDisabled(row.item)}
          // The visible label already reads the item's name; the group only needs
          // spelling out because its header row is presentational (see above).
          aria-label={row.group ? `${row.label}, ${row.group}` : undefined}
        >
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            {isSelected(row.item) && <CheckIcon size={12} />}
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

  return (
    <>
      <Combobox.Options ref={scrollRef} mah={LIST_MAX_HEIGHT} style={{ overflowY: 'auto' }}>
        {rows.length === 0 && <Combobox.Empty>{emptyMessage}</Combobox.Empty>}
        {rows.length > 0 && !isVirtualized
          && rows.map((_row, rowIndex) => renderRow(rowIndex, null))}
        {rows.length > 0 && isVirtualized && (
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
    </>
  );
}

/**
 * On touch devices the virtual keyboard covers the lower screen, leaving the
 * inline dropdown (rendered right below the field) no room to open into — it
 * clips or flips into the equally-cramped space above. Nudge the field up
 * toward the header on focus so the menu opens into the space above the
 * keyboard. Pointer-, not width-gated: only a real touch keyboard steals the
 * room. No-op on desktop, where an unbidden page jump would just be jarring.
 */
export function scrollFieldToTopOnTouch(element: HTMLElement | null) {
  if (!element || !window.matchMedia('(pointer: coarse)').matches) {
    return;
  }
  requestAnimationFrame(() => {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
