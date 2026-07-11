'use client';

import { useEffect, useRef, useState } from 'react';

import { APP_NAME } from '@/app/app.constants';
import { wizda } from '@/mascot/voice';
import { WizdaGlyph } from '@/mascot/wizda';
import { api, subscribeMaintenance } from '@/services/api';
import { Box, Stack, Text, Title } from '@mantine/core';

/** How often to poll for recovery while she's away. */
const POLL_INTERVAL_MS = 10_000;
/** How long the "I'm back!" beat holds before reloading — long enough for the rise-and-grow to play. */
const BACK_HOLD_MS = 1600;

type Phase = 'present' | 'away' | 'back';

/**
 * A global, full-screen takeover shown whenever the backend is down for a
 * reseed (see `packages/backend-api/src/index.ts`'s maintenance middleware).
 * Since every page depends on the DB, this is the single gate for all of
 * them — it renders on top of whatever route is mounted, restricting access
 * rather than letting each page discover and handle a 503 on its own.
 *
 * We never say "maintenance" to the player; Wizda's just stepped out. While
 * she's away we quietly poll for recovery so the app comes back on its own.
 */
export function MaintenanceGate() {
  const [phase, setPhase] = useState<Phase>('present');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    let alive = true;

    // Any fetch anywhere hitting a 503 flips the gate.
    const unsubscribe = subscribeMaintenance(() => {
      if (alive) {
        setPhase((current) => (current === 'present' ? 'away' : current));
      }
    });

    // Proactively check once on mount too, so a page that makes no data
    // fetch of its own (e.g. About) still gets gated.
    api.dataStatus().catch(() => {
      // subscribeMaintenance already handles the 503 case; a non-maintenance
      // failure here just leaves the app to its own error handling.
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'away') {
      stopPolling();
      return;
    }

    pollRef.current = setInterval(() => {
      api.dataStatus()
        .then(() => setPhase('back'))
        .catch(() => { /* still away (or a transient blip) — keep polling */ });
    }, POLL_INTERVAL_MS);

    return stopPolling;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'back') {
      return;
    }
    const timeout = setTimeout(() => window.location.reload(), BACK_HOLD_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

  if (phase === 'present') {
    return null;
  }

  const isBack = phase === 'back';
  const Glyph = isBack ? WizdaGlyph.welcome : WizdaGlyph.greet;

  return (
    <Box
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'var(--mantine-color-dark-7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Stack align="center" gap={2} pt="15vh">
        <Title
          order={1}
          fz="2.25rem"
          c="crimson.5"
          style={{ letterSpacing: '0.08em' }}
        >
          {APP_NAME}
        </Title>
        <Text size="sm" c="dimmed" ta="center">
          A Wizardry Variants Daphne Assistant
        </Text>
      </Stack>

      <Stack align="center" gap="md" maw={420} px="md" style={{ flex: 1, justifyContent: 'center' }}>
        <Box
          key={phase}
          className={isBack ? 'wizda-rise wizda-icon-outline' : 'wizda-float wizda-icon-outline'}
          style={{ display: 'flex' }}
        >
          <Glyph size={96} color="var(--mantine-color-crimson-5)" />
        </Box>
        <Text className="wizda-speech" ta="center">
          {isBack ? wizda.away.back : wizda.away.title}
        </Text>
      </Stack>
    </Box>
  );
}
