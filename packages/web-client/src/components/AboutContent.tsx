'use client';

import { APP_NAME, DATA_SOURCE_URL, ORACLE_NAME, SUPPORT_URL } from '@/app/app.constants';
import { Anchor, Button, List, Paper, Stack, Text, Title } from '@mantine/core';
import { IconHeartFilled } from '@tabler/icons-react';

export function AboutContent() {
  return (
    <Stack gap="lg" maw={720}>
      <div>
        <Title order={2}>About {APP_NAME}</Title>
        <Text className="wizda-speech">
          Hi! I&apos;m Wizda. Let me save you the tedious inventory math.
        </Text>
      </div>

      <Text>
        {APP_NAME} tells you how much <strong>junk</strong> you need to grind
        to <strong>guarantee</strong> a specific item in <em>Wizardry Variants Daphne</em> —
        so the fiddly drop-rate reversing gets done once, not every run. Use the{' '}
        <strong>{ORACLE_NAME}</strong> to pick what you&apos;re after, and browse the
        Junk and Equipment lists for a tidier, searchable view of the game&apos;s data.
      </Text>

      <Paper withBorder p="md" radius="md">
        <Title order={4} mb="xs">How the &ldquo;guarantee&rdquo; works</Title>
        <Text size="sm">
          A drop is never truly 100% certain, so instead of promising the impossible,
          the {ORACLE_NAME} answers &ldquo;how much junk to reach the confidence you
          asked for&rdquo;. Crank it as high as you like — but even at
          the top, RNG still has the final say.
        </Text>
      </Paper>

      <div>
        <Title order={4} mb="xs">Two things to keep in mind</Title>
        <List spacing="xs" size="sm">
          <List.Item>
            <strong>Blessing counts are estimates.</strong> The official source only gives
            per-slot odds, not combined ones, so any result that filters by blessings is
            approximate (we flag it when it happens).
          </List.Item>
          <List.Item>
            <strong>Some junk has multiple versions.</strong> A few junks changed over
            time; we store the newest. If you haven&apos;t unlocked an area&apos;s newer
            pool, your real drops may differ — those are marked with a note.
          </List.Item>
        </List>
      </div>

      <div>
        <Title order={4} mb="xs">Data &amp; privacy</Title>
        <Text size="sm">
          Drop-rate data is compiled from{' '}
          <Anchor href={DATA_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            the official lists
          </Anchor>
          &nbsp;provided by the game devs. Equipment details come from the{' '}
          <Anchor href="https://wizardry.fasterthoughts.io/" target="_blank" rel="noopener noreferrer">
            Fasterthoughts guide
          </Anchor>
          &nbsp;— special thanks to NRJank and the rest of the Fasterthoughts guys for compiling and maintaining 
          equipment lists.
        </Text>
        <Text size="sm" mt="md">
          We collect only minimal, anonymous usage stats to see what&apos;s useful — no accounts, and we never
          sell your data to anyone.
        </Text>
      </div>

      <div>
        <Title order={4} mb="xs">Support the project</Title>
        <Text size="sm" mb="sm">
          {APP_NAME} is free. If it saved you some grinding and you&apos;d like to help
          cover the server costs so it keeps running, a small tip goes a long way — no
          pressure at all.
        </Text>
        <Button
          component="a"
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          color="crimson"
          variant="light"
          leftSection={<IconHeartFilled size={16} />}
        >
          Support the project
        </Button>
      </div>

      <Text size="xs" c="dimmed">
        {APP_NAME} is an unofficial, fan-made tool and isn&apos;t affiliated with or
        endorsed by the makers of Wizardry Variants Daphne.
      </Text>
    </Stack>
  );
}
