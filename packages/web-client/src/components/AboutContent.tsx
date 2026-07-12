'use client';

import {
    ANALYTICS_DOC_URL, APP_NAME, CALCULATION_DOC_URL, DATA_SOURCE_URL, DOMAIN_DOC_URL,
    ISSUES_URL, ORACLE_NAME, REPO_URL, SUPPORT_URL
} from '@/app/app.constants';
import { wizda } from '@/mascot/voice';
import { Anchor, Button, Code, Group, List, Paper, Stack, Text, Title } from '@mantine/core';
import { IconBrandGithub, IconHeartFilled } from '@tabler/icons-react';

// The two lines that produce every number the Oracle prints. Real newlines, so
// this can't go through `TsUtilities.stringJoin` (which joins prose with spaces).
const FORMULA = [
  'n = ⌈ ln(1 − c) / ln(1 − P) ⌉',
  '',
  'P(b₁ … b_m) = Π_s  rate_s(b_s) / Σ_{x ∉ taken} rate_s(x)',
].join('\n');

export function AboutContent() {
  return (
    <Stack gap="lg" maw={720}>
      <div>
        <Title order={2}>About {APP_NAME}</Title>
        <Text className="wizda-speech">
          {wizda.about.intro}
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
            <strong>Blessing odds rest on one assumption.</strong> The devs publish each
            slot&apos;s odds, but never say what the game does when a slot rolls a blessing
            the piece already has. We assume it rerolls that slot. If it starts the whole
            piece over instead, results shift by well under 1% for most gear — about a tenth
            at the extremes. We flag every result that leans on this.
          </List.Item>
          <List.Item>
            <strong>Some junk has multiple versions.</strong> A few junks changed over
            time; we store the newest. If you haven&apos;t unlocked an area&apos;s newer
            pool, your real drops may differ — those are marked with a note.
          </List.Item>
        </List>
      </div>

      <div>
        <Title order={4} mb="xs">Contribute</Title>
        <Text size="sm" mb="sm">
          {APP_NAME} is open source, and none of the maths is hidden. Nearly every number
          the {ORACLE_NAME} prints comes out of these two lines:
        </Text>
        <Code block>{FORMULA}</Code>
        <Text size="sm" mt="sm">
          The first is how much junk reaches certainty <em>c</em> when a single junk has
          chance <em>P</em>. The second is how a piece fills its blessing slots — one at a
          time, in order, never repeating, each slot re-weighted over whatever is left. The{' '}
          <Anchor href={CALCULATION_DOC_URL} target="_blank" rel="noopener noreferrer">
            calculation doc
          </Anchor>
          &nbsp;derives both in full; the{' '}
          <Anchor href={DOMAIN_DOC_URL} target="_blank" rel="noopener noreferrer">
            domain doc
          </Anchor>
          &nbsp;covers how the game&apos;s drop tables are shaped.
        </Text>
        <Text size="sm" mt="sm" mb="sm">
          If we&apos;ve got something wrong, please tell us — especially if you play and
          know a mechanic we&apos;ve modelled badly. Open an{' '}
          <Anchor href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            issue
          </Anchor>
          &nbsp;or send a pull request. You know things we don&apos;t.
        </Text>
        <Group>
          <Button
            component="a"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="default"
            leftSection={<IconBrandGithub size={16} />}
          >
            {APP_NAME} on GitHub
          </Button>
        </Group>
      </div>

      <div id="data-privacy" style={{ scrollMarginTop: '72px' }}>
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
          sell your data to anyone. There are no cookies and nothing links your visits together, which is why
          you won&apos;t find a &ldquo;cookie consent&rdquo; popup here — there&apos;s nothing for one to ask
          permission for. See the{' '}
          <Anchor href={ANALYTICS_DOC_URL} target="_blank" rel="noopener noreferrer">
            analytics doc
          </Anchor>
          &nbsp;for the full breakdown of what we track.
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

      <div>
        <Title order={4} mb="xs">Credits</Title>
        <Text size="sm">
          Equipment icons by Lorc, Delapouite and contributors, from{' '}
          <Anchor href="https://game-icons.net/" target="_blank" rel="noopener noreferrer">
            game-icons.net
          </Anchor>
          , used under{' '}
          <Anchor
            href="https://creativecommons.org/licenses/by/3.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY 3.0
          </Anchor>
          . Interface icons from{' '}
          <Anchor href="https://tabler.io/icons" target="_blank" rel="noopener noreferrer">
            Tabler Icons
          </Anchor>
          &nbsp;(MIT).
        </Text>
      </div>

      <Text size="xs" c="dimmed">
        {APP_NAME} is an unofficial, fan-made tool and isn&apos;t affiliated with or
        endorsed by the makers of Wizardry Variants Daphne.
      </Text>
    </Stack>
  );
}
