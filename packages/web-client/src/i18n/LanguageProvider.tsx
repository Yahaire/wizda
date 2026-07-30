'use client';

import { createContext, useContext, useMemo } from 'react';

import { setActiveLang, stringsFor, wizdaFor } from './languageStore';
import { localeHref } from './locale';

import type { SupportedLanguage } from './locale';
import type { UiStrings } from './strings';
import type { WizdaLines } from '@/mascot/voice';

interface LanguageContextValue {
  lang: SupportedLanguage,
  strings: UiStrings,
  wizda: WizdaLines,
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Publishes the active language to the tree. It holds no state of its own: the
 * language is the `[lang]` route segment, resolved on the server, so the very
 * first render — including the prerendered HTML — is already correct. Switching
 * language is a navigation, not a state update; see `LanguageToggle` and
 * `docs/i18n.md`.
 *
 * That is the whole fix for the old English-then-Japanese flash. The previous
 * version read the preference from `localStorage` in a post-mount effect, which
 * could never beat first paint no matter how it was tuned — the served HTML was
 * English before any JS ran.
 *
 * Wizda's voice rides the same switch: components read her through `useWizda()`
 * here rather than a module constant, so she changes language in lockstep with
 * the rest of the UI.
 */
export function LanguageProvider({
  lang,
  children,
}: {
  lang: SupportedLanguage,
  children: React.ReactNode,
}) {
  // Update the module-level mirror (read by non-React code and by the display
  // helpers in `gearDisplays`/`oracle.logic`) synchronously during render, not in
  // an effect: this provider renders before its descendants, so the mirror is
  // already current when they read `getStrings()`/`getWizda()` on the same render.
  // It is also what keeps `services/api.ts` from firing its first request under
  // the wrong language — an effect would land after those fetches had gone out.
  setActiveLang(lang);

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    strings: stringsFor(lang),
    wizda: wizdaFor(lang),
  }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

function useLanguageContext(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage hooks must be used inside a <LanguageProvider>');
  }
  return context;
}

export function useLang(): SupportedLanguage {
  return useLanguageContext().lang;
}

/** The active UI-chrome catalog; re-renders the caller when the language changes. */
export function useStrings(): UiStrings {
  return useLanguageContext().strings;
}

/** Wizda's active catalog; re-renders the caller when the language changes. */
export function useWizda(): WizdaLines {
  return useLanguageContext().wizda;
}

/**
 * Turns an unprefixed in-app path into one under the active language —
 * `/junks` becomes `/ja/junks`. **Every internal `href` must go through this**;
 * a bare `/junks` would bounce through the middleware's redirect on each click
 * instead of navigating client-side.
 */
export function useLocaleHref(): (path: string) => string {
  const lang = useLang();
  return (path: string) => localeHref(lang, path);
}
