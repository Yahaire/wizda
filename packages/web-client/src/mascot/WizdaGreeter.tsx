'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, Text } from '@mantine/core';

import { wizda } from './voice';
import { pickGreeting, WizdaGlyph, WizdaMark, wizdaSay } from './wizda';

const WELCOMED_KEY = 'wizda.welcomed';
const LAST_GREETED_KEY = 'wizda.lastGreeted';
const SMALL_SCREEN = '(max-width: 48em)';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Greets the visitor once ever (welcome) and once per day thereafter. The
 * one-time welcome only fires on the home page — a visitor landing first on
 * some other route (e.g. a shared /junks link) won't see it until they visit
 * home, since Shell stays mounted across client-side navigation and this
 * effect re-checks on every pathname change. To stay out of the way on
 * phones, the daily greeting becomes a subtle dismissible banner on small
 * screens instead of a toast; the one-time welcome is always a toast. Flags
 * are written before showing anything, so StrictMode's double-mount never
 * double-greets.
 */
export function WizdaGreeter() {
  const pathname = usePathname();
  const [banner, setBanner] = useState<string | null>(null);

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

    const line = pickGreeting();
    const isSmall = window.matchMedia(SMALL_SCREEN).matches;
    if (isSmall) {
      setBanner(line);
    } else {
      wizdaSay(line, { glyph: WizdaGlyph.greet, autoClose: 7000 });
    }
  }, [pathname]);

  if (!banner) {
    return null;
  }

  return (
    <Alert
      color="crimson"
      variant="light"
      withCloseButton
      onClose={() => setBanner(null)}
      mb="md"
    >
      <Text component="span" className="wizda-speech">
        <WizdaMark glyph={WizdaGlyph.greet} />{banner}
      </Text>
    </Alert>
  );
}
