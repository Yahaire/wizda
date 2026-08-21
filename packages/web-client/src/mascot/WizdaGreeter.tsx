'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { ROUTE_PATHS } from '@/app/pageMetadata';
import { useWizda } from '@/i18n/LanguageProvider';
import { stripLocale } from '@/i18n/locale';

import { pickGreeting, WizdaGlyph, wizdaSay } from './wizda';

const WELCOMED_KEY = 'wizda.welcomed';
const LAST_GREETED_KEY = 'wizda.lastGreeted';

/**
 * Where the one-time welcome may fire: the app's *tools*, plus the root for
 * whenever a real homepage takes it back (nothing serves `/` today — it 307s
 * to the Oracle, see `middleware.ts`). **Add each new tool here as it ships.**
 *
 * The lists and About are deliberately absent, which is the original rule kept
 * intact rather than a new one: a welcome should land somewhere the player can
 * act on it, so someone who arrives on a shared reference table gets greeted
 * when they first reach a tool instead of being interrupted on the way.
 *
 * A set of paths, sourced from the shared route table, because a lone literal
 * is what broke this once already: the check used to be `pathname !== '/'`, and
 * when the Oracle moved off the root it went quiet rather than wrong — no
 * visitor reached `/` again, so nobody was welcomed, and since the daily
 * greeting only begins *after* the welcome, that stopped with it.
 */
const GREETING_PATHS: ReadonlySet<string> = new Set([
  '/',
  ROUTE_PATHS.oracle,
]);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Greets the visitor once ever (welcome) and once per day thereafter, both as
 * toasts. The one-time welcome only fires on a tool page (see {@link
 * GREETING_PATHS}) — a visitor arriving first on some other route (e.g. a
 * shared /junks link) won't see it until they reach one, since Shell stays
 * mounted across client-side navigation and this effect re-checks on every
 * pathname change. Flags are written before showing anything, so StrictMode's
 * double-mount never double-greets. Renders nothing — it only fires the toasts.
 */
export function WizdaGreeter() {
  // Locale-stripped, so "am I on a tool page" is one check rather than one per
  // language.
  const pathname = stripLocale(usePathname());
  const wizda = useWizda();

  useEffect(() => {
    const welcomed = localStorage.getItem(WELCOMED_KEY);
    const stamp = today();

    if (!welcomed) {
      if (!GREETING_PATHS.has(pathname)) {
        return;
      }
      localStorage.setItem(WELCOMED_KEY, '1');
      localStorage.setItem(LAST_GREETED_KEY, stamp);
      wizdaSay(wizda.greet.welcome, { glyph: WizdaGlyph.welcome, autoClose: 8000 });
      return;
    }

    if (localStorage.getItem(LAST_GREETED_KEY) === stamp) {
      return;
    }
    localStorage.setItem(LAST_GREETED_KEY, stamp);

    wizdaSay(pickGreeting(), { glyph: WizdaGlyph.greet, autoClose: 7000 });
    // `wizda` participates so a language switch re-reads her line; the daily-stamp
    // guard above keeps that from greeting twice.
  }, [pathname, wizda]);

  return null;
}
