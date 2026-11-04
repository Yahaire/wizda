import type { SlotField } from './enhancement.logic';

/**
 * The attributes that let a blocked Calculate find, mark and focus one control
 * in a slot's row. Spread onto the control itself — on a Mantine input they
 * land on the `<input>`, which is what `globals.css`'s `input[data-missing]`
 * styles and what gets focused.
 */
export interface FieldMarks {
  'data-slot-field': SlotField,
  'data-missing'?: true,
  'aria-invalid'?: true,
}

export function fieldMarks(field: SlotField, missing: ReadonlySet<SlotField>): FieldMarks {
  const isMissing = missing.has(field);
  return {
    'data-slot-field': field,
    ...(isMissing && {
      'data-missing': true,
      'aria-invalid': true,
    }),
  };
}

/** The attributes on a slot's row: found by slot, and barred on its leading edge while anything in it is missing. */
export function slotRowMarks(slot: number, missing: ReadonlySet<SlotField>) {
  return {
    'data-slot-row': slot,
    ...(missing.size > 0 && { 'data-missing': true }),
  };
}

/**
 * Brings one slot's control to the player after a blocked Calculate: scrolls
 * its row into view, then focuses the control.
 *
 * The *row* is scrolled, with `block: 'nearest'`, so this moves the page only
 * when the row isn't already fully visible — in practice a narrow screen, where
 * Calculate sits far below the slots, while a wide one usually doesn't budge.
 * The row carries `.wizda-scroll-clear-header`, so "fully visible" excludes the
 * strip under the fixed header. Focus then skips its own scroll, which would
 * otherwise jump straight to the control and cancel the smooth one.
 *
 * A segmented control is marked on its root, so its checked option (or else
 * its first) is what takes focus.
 */
export function revealSlotField(container: HTMLElement | null, slot: number, field: SlotField) {
  const row = container?.querySelector<HTMLElement>(`[data-slot-row="${slot}"]`);
  const control = row?.querySelector<HTMLElement>(`[data-slot-field="${field}"]`);
  if (!row || !control) {
    return;
  }
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const focusable = control instanceof HTMLInputElement
    ? control
    : (control.querySelector<HTMLElement>('input:checked') ?? control.querySelector<HTMLElement>('input'));
  focusable?.focus({ preventScroll: true });
}
