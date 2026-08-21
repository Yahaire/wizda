import { useRef, useState } from 'react';

import { useDebouncedValue } from '@mantine/hooks';

import type { CompositionEvent } from 'react';

/** How long typing must pause before the catalog is re-filtered. */
const SEARCH_DEBOUNCE_MS = 300;

export interface DebouncedSearch {
  /** The live input value. Bind this to the field so typing never feels laggy. */
  value: string,
  /** Sets the live value. Bind to the field's `onChange`. */
  setValue: (next: string) => void,
  /** The value to actually filter on — debounced, and never mid-IME-composition. */
  debounced: string,
  /** Spread onto the input: the composition handlers this hook needs to do its job. */
  compositionProps: {
    onCompositionStart: () => void,
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => void,
  },
}

/**
 * A debounced search value that understands IME composition.
 *
 * The two halves are one feature, not two. While a Japanese IME is composing,
 * `onChange` fires for every uncommitted keystroke — typing `らいおん` emits a
 * handful of intermediate states before the word exists. A plain debounce
 * happily filters the catalog against those fragments, so results thrash while
 * the player is still mid-word and land on something unrelated. Gating on
 * composition and debouncing separately each fix half of it; together they mean
 * the filter only ever sees text the player has actually committed.
 *
 * The live `value` is deliberately *not* gated — the field must echo every
 * keystroke, including composition ones, or typing feels broken. Only what we
 * search on waits.
 *
 * @param initialValue Seeds `value`/`committed` once, on mount — e.g. from a
 * shareable `?q=` URL. Changing it on a later render has no effect; after
 * mount the input owns its own value.
 */
export function useDebouncedSearch(initialValue = ''): DebouncedSearch {
  const [value, setValueState] = useState(initialValue);
  /** What the debounce watches: the live value, minus anything typed mid-composition. */
  const [committed, setCommitted] = useState(initialValue);
  // A ref, not state: the change handler below reads this on the same tick it's
  // set, and a value that only lands on the next render is too late to gate on.
  const isComposing = useRef(false);

  const setValue = (next: string) => {
    setValueState(next);
    if (!isComposing.current) {
      setCommitted(next);
    }
  };

  const [debounced] = useDebouncedValue(committed, SEARCH_DEBOUNCE_MS);

  return {
    value,
    setValue,
    debounced,
    compositionProps: {
      onCompositionStart: () => {
        isComposing.current = true;
      },
      onCompositionEnd: (event) => {
        isComposing.current = false;
        // `compositionend` fires *before* React's change event for the committed
        // text, so read the value off the element rather than waiting for a
        // change that may never come (picking a candidate with the mouse ends
        // composition without another keystroke).
        setCommitted(event.currentTarget.value);
      },
    },
  };
}
