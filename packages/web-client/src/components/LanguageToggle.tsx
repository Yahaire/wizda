'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useLang, useStrings } from '@/i18n/LanguageProvider';
import {
    isSupportedLanguage, LANGUAGE_ENDONYMS, LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME,
    OFFERED_LANGUAGES, swapLocalePath
} from '@/i18n/locale';
import { Group, SegmentedControl } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';

import type { SupportedLanguage } from '@/i18n/locale';

/** The old localStorage key, kept only for the one-time migration below. */
const LEGACY_LANGUAGE_STORAGE_KEY = 'wizda.lang';

/**
 * Records an explicit choice so a later visit to a language-less URL (someone
 * typing `wizda.app`) opens in the language they picked. Written *only* from a
 * real click — auto-detection never calls this — so a visitor who never touches
 * the switcher stores nothing at all.
 *
 * `Lax` because it only ever needs to be read on a top-level navigation to our
 * own origin, and it is deliberately readable by JS: there is no secret here,
 * and it saves a round-trip for the migration below.
 */
function rememberLanguage(lang: SupportedLanguage): void {
  document.cookie = [
    `${LOCALE_COOKIE_NAME}=${lang}`,
    'path=/',
    `max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
}

/**
 * The site-language switcher — a globe icon beside an EN / 日本語 toggle. Each
 * language is labelled by its own endonym (never translated), so it reads the
 * same whatever the current language is. Sits in the navbar footer (see
 * `Shell.tsx`).
 *
 * Switching is a **navigation**, not a state change: the language is the first
 * path segment, so the other language is simply the same route under the other
 * prefix. See `docs/i18n.md`.
 */
export function LanguageToggle() {
  const lang = useLang();
  const strings = useStrings();
  const router = useRouter();
  const pathname = usePathname();

  // One-time migration off the pre-split `localStorage` preference. The old
  // detection bug wrote `"en"` for *everyone* on first load, so only a stored
  // `"ja"` can represent a deliberate click — migrating anything else would
  // hand out cookies nobody asked for. Deliberately does not navigate: the
  // preference simply applies the next time they arrive on a language-less URL,
  // which keeps this flash-free. Safe to delete a release or two from now.
  useEffect(() => {
    const stored = window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
    if (stored === null) {
      return;
    }
    window.localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
    // Stored JSON-serialized (`"ja"`), but strip quotes rather than parsing so
    // a malformed leftover can't throw on someone's first load.
    if (stored.replace(/"/g, '') === 'ja') {
      rememberLanguage('ja');
    }
  }, []);

  const data = OFFERED_LANGUAGES.map((code) => ({
    value: code,
    label: LANGUAGE_ENDONYMS[code],
  }));

  return (
    <Group gap="xs" wrap="nowrap" justify="center" aria-label={strings.nav.languageToggleAriaLabel}>
      <IconWorld size={18} style={{ opacity: 0.7, flexShrink: 0 }} />
      <SegmentedControl
        size="xs"
        value={lang}
        onChange={(value) => {
          if (!isSupportedLanguage(value)) {
            return;
          }
          rememberLanguage(value);
          // `window.location.search` rather than `useSearchParams()`: this
          // toggle sits in `Shell`, i.e. on every page, so reading search
          // params here would force a Suspense boundary sitewide. A click
          // handler is client-only by definition, so reading it off `window`
          // costs nothing.
          router.push(`${swapLocalePath(pathname, value)}${window.location.search}`);
        }}
        data={data}
      />
    </Group>
  );
}
