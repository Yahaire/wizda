'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { wizda } from './voice';
import { pickGreeting, WizdaGlyph, wizdaSay } from './wizda';

const WELCOMED_KEY = 'wizda.welcomed';
const LAST_GREETED_KEY = 'wizda.lastGreeted';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Greets the visitor once ever (welcome) and once per day thereafter, both as
 * toasts. The one-time welcome only fires on the home page — a visitor landing
 * first on some other route (e.g. a shared /junks link) won't see it until they
 * visit home, since Shell stays mounted across client-side navigation and this
 * effect re-checks on every pathname change. Flags are written before showing
 * anything, so StrictMode's double-mount never double-greets. Renders nothing —
 * it only fires the toasts.
 */
export function WizdaGreeter() {
  const pathname = usePathname();

  useEffect(() => {
    const welcomed = localStorage.getItem(WELCOMED_KEY);
    const stamp = today();

    if (!welcomed) {
      if (pathname !== '/') {
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
  }, [pathname]);

  return null;
}
