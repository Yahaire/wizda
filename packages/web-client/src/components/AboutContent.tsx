'use client';

import {
    ANALYTICS_DOC_URL, APP_NAME, CALCULATION_DOC_URL, DATA_SOURCE_URL, DOMAIN_DOC_URL, ISSUES_URL,
    ORACLE_NAME, REPO_URL, SUPPORT_URL
} from '@/app/app.constants';
import { useStrings, useWizda } from '@/i18n/LanguageProvider';
import { Anchor, Button, Code, Group, List, Paper, Stack, Text, Title } from '@mantine/core';
import { IconBrandGithub, IconHeartFilled } from '@tabler/icons-react';

// The two lines that produce every number the Oracle prints. Real newlines, so
// this can't go through `TsUtilities.stringJoin` (which joins prose with spaces).
const FORMULA = [
  'n = ⌈ ln(1 − c) / ln(1 − P) ⌉',
  '',
  'P(b₁ … b_m) = Π_s  rate_s(b_s) / Σ_{x ∉ taken} rate_s(x)',
].join('\n');

const GAME_ICONS_URL = 'https://game-icons.net/';
const CC_BY_URL = 'https://creativecommons.org/licenses/by/3.0/';
const TABLER_URL = 'https://tabler.io/icons';
const FASTERTHOUGHTS_URL = 'https://wizardry.fasterthoughts.io/';

export function AboutContent() {
  const strings = useStrings();
  const about = strings.about;
  const wizda = useWizda();

  return (
    <Stack gap="lg" maw={720}>
      <div>
        <Title order={2}>{about.title(APP_NAME)}</Title>
        <Text className="wizda-speech">
          {wizda.about.intro}
        </Text>
      </div>

      <Text>{about.introBody(APP_NAME, ORACLE_NAME)}</Text>

      <Paper withBorder p="md" radius="md">
        <Title order={4} mb="xs">{about.guaranteeHeading}</Title>
        <Text size="sm">{about.guaranteeBody(ORACLE_NAME)}</Text>
      </Paper>

      <div>
        <Title order={4} mb="xs">{about.twoThingsHeading}</Title>
        <List spacing="xs" size="sm">
          <List.Item>
            <strong>{about.blessingOddsLead}</strong> {about.blessingOddsRest}
          </List.Item>
          <List.Item>
            <strong>{about.multiplePoolsLead}</strong> {about.multiplePoolsRest}
          </List.Item>
        </List>
      </div>

      <div>
        <Title order={4} mb="xs">{about.contributeHeading}</Title>
        <Text size="sm" mb="sm">{about.contributeIntro(APP_NAME, ORACLE_NAME)}</Text>
        <Code block>{FORMULA}</Code>
        <Text size="sm" mt="sm">
          {about.formulaExplanation}{' '}
          {about.docsReferenceLabel}{' '}
          <Anchor href={CALCULATION_DOC_URL} target="_blank" rel="noopener noreferrer">
            {about.calculationDocLinkLabel}
          </Anchor>
          {' · '}
          <Anchor href={DOMAIN_DOC_URL} target="_blank" rel="noopener noreferrer">
            {about.domainDocLinkLabel}
          </Anchor>
        </Text>
        <Text size="sm" mt="sm" mb="sm">
          {about.askForHelpBody}{' '}
          <Anchor href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            {about.issueLinkLabel}
          </Anchor>
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
            {about.githubButton(APP_NAME)}
          </Button>
        </Group>
      </div>

      <div id="data-privacy" className="wizda-scroll-clear-header">
        <Title order={4} mb="xs">{about.dataPrivacyHeading}</Title>
        <Text size="sm">
          {about.dataPrivacyPrefix}{' '}
          <Anchor href={DATA_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            {about.officialListsLinkLabel}
          </Anchor>{' '}
          {about.dataPrivacyMiddle}{' '}
          <Anchor href={FASTERTHOUGHTS_URL} target="_blank" rel="noopener noreferrer">
            {about.fasterthoughtsLinkLabel}
          </Anchor>{' '}
          {about.dataPrivacySuffix}
        </Text>
        <Text size="sm" mt="md">
          {about.privacyBody}{' '}
          <Anchor href={ANALYTICS_DOC_URL} target="_blank" rel="noopener noreferrer">
            {about.analyticsLinkLabel}
          </Anchor>
        </Text>
      </div>

      <div>
        <Title order={4} mb="xs">{about.supportHeading}</Title>
        <Text size="sm" mb="sm" style={{ whiteSpace: 'pre-line' }}>
          {about.supportBody(APP_NAME)}
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
          {about.supportButtonLabel}
        </Button>
      </div>

      <div>
        <Title order={4} mb="xs">{about.creditsHeading}</Title>
        <Text size="sm">{about.creditsBody}</Text>
        {/* Attribution links the licences ask us to carry — proper nouns, not translated. */}
        <Group gap="xs" mt={4}>
          <Anchor href={GAME_ICONS_URL} target="_blank" rel="noopener noreferrer" size="sm">
            game-icons.net
          </Anchor>
          <Anchor href={CC_BY_URL} target="_blank" rel="noopener noreferrer" size="sm">
            CC BY 3.0
          </Anchor>
          <Anchor href={TABLER_URL} target="_blank" rel="noopener noreferrer" size="sm">
            Tabler Icons
          </Anchor>
        </Group>
      </div>

      <Text size="xs" c="dimmed">
        {APP_NAME} {about.disclaimer}
      </Text>
    </Stack>
  );
}
