'use client';

import { useEffect } from 'react';

/**
 * Tracks keyboard vs. pointer as the most recent input modality and stamps it on
 * `<html data-focus-modality>` (mirrors the WICG `focus-visible` polyfill's
 * heuristic: github.com/WICG/focus-visible). `globals.css` uses the attribute to
 * force-hide `:focus-visible` rings while in pointer modality.
 *
 * Needed because Mantine's modals move focus programmatically — a focus trap grabs
 * the first focusable element on open, and focus is returned to the trigger on
 * close — outside the click/keydown that caused it. The browser's own
 * `:focus-visible` heuristic can't always tell that apart from real keyboard focus,
 * so a modal opened or closed by a click can leave a ring on an element the user
 * never touched with the keyboard (see the FilterField info-modal repro this was
 * written for).
 */
export function FocusModalityWatcher() {
  useEffect(() => {
    // "pointer" rather than "mouse": `pointerdown` also covers touch and pen, and
    // neither of those should reveal a focus ring either.
    const setModality = (modality: 'keyboard' | 'pointer') => {
      document.documentElement.dataset.focusModality = modality;
    };

    // Ignore modifier-only combos (Cmd+C, Alt+Tab, …) — those are shortcuts, not
    // the kind of navigation keypress that should reveal a focus ring.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.altKey || event.ctrlKey) {
        return;
      }
      setModality('keyboard');
    };

    const onPointerDown = () => setModality('pointer');

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      delete document.documentElement.dataset.focusModality;
    };
  }, []);

  return null;
}
