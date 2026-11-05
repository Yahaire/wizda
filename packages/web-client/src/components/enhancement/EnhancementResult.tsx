'use client';

import { ENHANCEMENT_CALCULATION_DOC_URL } from '@/app/app.constants';
import { formatPercent } from '@/components/oracle/oracle.logic';
import { useStrings, useWizda } from '@/i18n/LanguageProvider';
import { WizdaGlyph, WizdaMark } from '@/mascot/wizda';
import {
    ActionIcon, Alert, Anchor, Center, Group, List, Loader, Modal, Stack, Text, Tooltip
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    ENHANCEMENT_WARNINGS, EnhancementNoteCode, EnhancementOddsResult, EnhancementWarningCode
} from '@shared/api/endpoints/enhancementOdds.models';
import { IconAlertTriangle, IconHistory, IconInfoCircle } from '@tabler/icons-react';

import { CaveatIcons } from './CaveatIcons';

interface EnhancementResultProps {
  loading: boolean,
  error: string | null,
  result: EnhancementOddsResult | null,
  gradeUnknown: boolean,
  /**
   * The form has moved since `result` was computed. The number stays on
   * screen — it was true of *some* question — but dimmed and captioned, so
   * it can't be read as the answer to the form as it now stands.
   */
  stale: boolean,
  /**
   * The WANT-face card, for the one layout where the previews above the
   * result are hidden (see `PREVIEW_BREAKPOINT`): on a narrow screen the
   * per-slot picture lives inside the result instead, where it is read
   * after the form rather than beside it.
   */
  narrowPreview?: React.ReactNode,
}

/**
 * "How this works", behind the ⓘ beside the probability: Wizda says what the
 * number means, then the rules behind it that this result leans on. Kept out of
 * the panel itself — players come for the percentage, and the rules are a
 * read-once explanation rather than part of every answer.
 */
function HowItWorksModal({
  opened,
  onClose,
  notes,
}: {
  opened: boolean,
  onClose: () => void,
  notes: readonly EnhancementNoteCode[],
}) {
  const strings = useStrings();
  const wizda = useWizda();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={strings.enhancement.howItWorksTitle}
      centered
      size="md"
    >
      <Stack gap="md">
        <Text className="wizda-speech"><WizdaMark glyph={WizdaGlyph.info} />{wizda.enhancement.howItWorks}</Text>

        {notes.length > 0 && (
          <Stack gap="xs">
            <Text fw={600} size="sm">{strings.enhancement.notesHeading}</Text>
            <List size="sm" spacing="xs">
              {notes.map((note) => (
                <List.Item key={note}>
                  <Text span fw={600} size="sm">{strings.enhancement.notes[note].title}</Text>
                  {' — '}
                  {strings.enhancement.notes[note].body}
                </List.Item>
              ))}
            </List>
          </Stack>
        )}

        <Text size="sm" c="dimmed">
          {wizda.oracle.estimateNoteLink}{' '}
          <Anchor
            href={ENHANCEMENT_CALCULATION_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            inherit
          >
            {strings.oracle.calculationDocLinkLabel}
          </Anchor>{' '}
          {strings.oracle.estimateFooterSuffix}
        </Text>
      </Stack>
    </Modal>
  );
}

/**
 * The headline of a computed result: the probability, the milestones still
 * ahead, and the data gaps that travel with the number; how it was worked out
 * sits one tap away, behind an ⓘ. The per-slot picture — what each slot ends
 * as, or what a milestone could roll there — is the WANT face of `PieceCard`,
 * drawn beside this rather than repeated under it; see `EnhancementOraclePage`.
 */
export function EnhancementResult({
  loading,
  error,
  result,
  gradeUnknown,
  stale,
  narrowPreview,
}: EnhancementResultProps) {
  const strings = useStrings();
  const [howItWorksOpened, howItWorks] = useDisclosure(false);

  if (loading) {
    return <Center mih={200}><Loader color="crimson" /></Center>;
  }

  if (error) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
        {error}
      </Alert>
    );
  }

  if (!result) {
    return <Text c="dimmed" ta="center" py="xl">{strings.enhancement.emptyPrompt}</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <Group gap={4} wrap="nowrap">
          <Text fw={600} size="lg">{strings.enhancement.probabilityLabel}</Text>
          <Tooltip label={strings.enhancement.howItWorksTitle} withArrow openDelay={300}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              radius="xl"
              aria-label={strings.enhancement.howItWorksTitle}
              onClick={howItWorks.open}
            >
              <IconInfoCircle size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <CaveatIcons gradeUnknown={gradeUnknown} />
      </Group>

      {stale && (
        <Alert color="gray" variant="light" icon={<IconHistory size={18} />}>
          {strings.enhancement.resultOutdated}
        </Alert>
      )}

      <div style={stale ? { opacity: 0.5 } : undefined}>
        {result.probability !== null ? (
          <Text fz="2rem" fw={700} c="crimson.4">{formatPercent(result.probability)}</Text>
        ) : (
          <Text fz="1.2rem" fw={600} c="dimmed">{strings.enhancement.noDataLabel}</Text>
        )}

        <Text size="sm" c="dimmed">
          {result.remainingMilestones.length > 0
            ? strings.enhancement.remainingMilestonesLabel(
              result.remainingMilestones.map((level) => `+${level}`).join(', '),
            )
            : strings.enhancement.noRemainingMilestones}
        </Text>
      </div>

      {result.warnings.length > 0 && (
        <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title={strings.enhancement.warningsHeading}>
          <Stack gap={4}>
            {result.warnings.map((warning: EnhancementWarningCode) => (
              <Text key={warning} size="sm">{ENHANCEMENT_WARNINGS[warning]}</Text>
            ))}
          </Stack>
        </Alert>
      )}

      {narrowPreview}

      <HowItWorksModal opened={howItWorksOpened} onClose={howItWorks.close} notes={result.notes} />
    </Stack>
  );
}
