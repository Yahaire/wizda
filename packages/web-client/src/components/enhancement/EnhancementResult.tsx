'use client';

import { formatPercent } from '@/components/oracle/oracle.logic';
import { useStrings } from '@/i18n/LanguageProvider';
import { Alert, Center, Group, Loader, Stack, Text } from '@mantine/core';
import {
    ENHANCEMENT_NOTES, ENHANCEMENT_WARNINGS, EnhancementOddsResult,
    EnhancementWarningCode
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
 * The headline of a computed result: the probability, the milestones still
 * ahead, and the data gaps and explanations that travel with the number. The
 * per-slot picture — what each slot ends as, or what a milestone could roll
 * there — is the WANT face of `PieceCard`, drawn beside this rather than
 * repeated under it; see `EnhancementOraclePage`.
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

  const notes = result.notes;

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600} size="lg">{strings.enhancement.probabilityLabel}</Text>
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

      {notes.length > 0 && (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />} title={strings.enhancement.notesHeading}>
          <Stack gap={4}>
            {notes.map((note) => (
              <Text key={note} size="sm">{ENHANCEMENT_NOTES[note]}</Text>
            ))}
          </Stack>
        </Alert>
      )}

      {narrowPreview}
    </Stack>
  );
}
