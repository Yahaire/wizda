'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Text,
} from '@mantine/core';

import {
  WIZDA_WELCOME,
  WizdaEmoji,
  pickGreeting,
  wizdaSay,
} from './wizda';

const WELCOMED_KEY = 'wizda.welcomed';
const LAST_GREETED_KEY = 'wizda.lastGreeted';
const SMALL_SCREEN = '(max-width: 48em)';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Greets the visitor once ever (welcome) and once per day thereafter. To stay
 * out of the way on phones, the daily greeting becomes a subtle dismissible
 * banner on small screens instead of a toast; the one-time welcome is always a
 * toast. Flags are written before showing anything, so StrictMode's double-mount
 * never double-greets.
 */
export function WizdaGreeter() {
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const welcomed = localStorage.getItem(WELCOMED_KEY);
    const stamp = today();

    if (!welcomed) {
      localStorage.setItem(WELCOMED_KEY, '1');
      localStorage.setItem(LAST_GREETED_KEY, stamp);
      wizdaSay(WIZDA_WELCOME, { emoji: WizdaEmoji.welcome, autoClose: 8000 });
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
      wizdaSay(line, { emoji: WizdaEmoji.greet, autoClose: 7000 });
    }
  }, []);

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
        {WizdaEmoji.greet} {banner}
      </Text>
    </Alert>
  );
}
