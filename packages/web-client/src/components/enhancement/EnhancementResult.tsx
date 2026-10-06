'use client';

import { blessingLabel, formatPercent } from '@/components/oracle/oracle.logic';
import { useStrings } from '@/i18n/LanguageProvider';
import { Alert, Center, Divider, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import {
    ENHANCEMENT_NOTES, ENHANCEMENT_WARNINGS, EnhancementOddsResult,
    EnhancementWarningCode
} from '@shared/api/endpoints/enhancementOdds.models';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

import { CaveatIcons } from './CaveatIcons';
import { formatValueRange } from './enhancement.logic';

interface EnhancementResultProps {
  loading: boolean,
  error: string | null,
  result: EnhancementOddsResult | null,
  gradeUnknown: boolean,
}

/**
 * `EnhancementResult`'s per-slot breakdown mirrors what the backend already
 * did the hard work of computing (`enhancementOdds()` in
 * `@shared/domain/enhancementMath`) — this only formats it. See
 * `docs/calculation/enhancement.md`, "What comes back".
 */
export function EnhancementResult({
  loading,
  error,
  result,
  gradeUnknown,
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

      <Divider />

      <Stack gap="xs">
        {result.slots.map((slot) => (
          <Paper key={slot.slot} withBorder p="sm" radius="sm">
            <Stack gap={4}>
              <Text fw={600} size="sm">{strings.enhancement.slotLabel(slot.slot)}</Text>

              {slot.candidates ? (
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">{strings.enhancement.slotResultCandidatesLabel}</Text>
                  {slot.candidates.map((candidate) => (
                    <Group key={candidate.blessingCode} justify="space-between" wrap="nowrap">
                      <Text size="sm">{blessingLabel(candidate.blessingCode)}</Text>
                      <Group gap="sm" wrap="nowrap">
                        <Text size="sm" c="dimmed">{formatValueRange(candidate.valueDistribution)}</Text>
                        <Text size="sm" fw={600} c="crimson.4">{formatPercent(candidate.probability)}</Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              ) : slot.blessingCode ? (
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{blessingLabel(slot.blessingCode)}</Text>
                  <Text size="sm" c="dimmed">
                    {slot.valueDistribution ? formatValueRange(slot.valueDistribution) : ''}
                  </Text>
                </Group>
              ) : (
                <Text size="sm" c="dimmed">{strings.enhancement.emptyOption}</Text>
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
