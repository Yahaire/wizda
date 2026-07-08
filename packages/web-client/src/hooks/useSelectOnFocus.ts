import { useRef } from 'react';

/**
 * Returns a ref + focus handler that select an input's text on focus, so the
 * next keystroke replaces it. Deferred a frame because a mouse click's own
 * mouseup would otherwise place the caret and wipe the selection right after
 * we set it.
 */
export function useSelectOnFocus<T extends HTMLInputElement>() {
  const ref = useRef<T>(null);

  const selectOnFocus = () => {
    requestAnimationFrame(() => {
      const input = ref.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  };

  return { ref, selectOnFocus };
}
