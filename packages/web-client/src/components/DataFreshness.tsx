'use client';

import { useEffect, useState } from 'react';

import { wizda } from '@/mascot/voice';
import { WizdaGlyph, wizdaSay } from '@/mascot/wizda';
import { api } from '@/services/api';
import { formatRelativeAge, isFreshWithinDay } from '@/utils/relativeTime';
import { Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { TsUtilities } from '@shared/tsUtilities';
import { IconRefresh } from '@tabler/icons-react';

/**
 * The muted "data last updated N ago" stamp that rides far-right in the header.
 * Reads the last successful seed time once; clicking (or tapping) it has Wizda
 * explain where the data comes from, in her voice, with a plain footnote + an ⓘ
 * to the About page's Data & privacy section. Renders nothing until it has a
 * timestamp, so a cold DB or a failed fetch just leaves the header clean.
 */
export function DataFreshness() {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.dataStatus()
      .then((status) => {
        if (active) {
          setUpdatedAt(status.dataUpdatedAt);
        }
      })
      .catch(() => { /* header stays clean if it can't load */ });
    return () => { active = false; };
  }, []);

  if (!updatedAt) {
    return null;
  }

  const speak = () => {
    const age = formatRelativeAge(updatedAt);
    const line = isFreshWithinDay(updatedAt)
      ? TsUtilities.stringJoin([wizda.data.freshness(age), wizda.data.freshInk])
      : wizda.data.freshness(age);
    wizdaSay(line, {
      glyph: WizdaGlyph.greet,
      autoClose: 12000,
      note: wizda.data.freshnessNote(age),
      noteHref: '/about#data-privacy',
    });
  };

  return (
    <Tooltip label="How fresh is this data?" position="bottom" withArrow openDelay={400}>
      <UnstyledButton
        onClick={speak}
        ml="auto"
        aria-label="Data freshness — where this data comes from"
        style={{ opacity: 0.6, transition: 'opacity 120ms ease' }}
        onMouseEnter={(event) => { event.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(event) => { event.currentTarget.style.opacity = '0.6'; }}
      >
        <Group gap={5} wrap="nowrap" align="center" c="dimmed">
          <IconRefresh size={12} />
          <Text size="xs" c="dimmed">{formatRelativeAge(updatedAt)}</Text>
        </Group>
      </UnstyledButton>
    </Tooltip>
  );
}
