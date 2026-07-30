'use client';

import { useMemo, useState } from 'react';

import { useDetail } from '@/components/detail/DetailProvider';
import { useStrings } from '@/i18n/LanguageProvider';
import { Divider, Group, Paper, Pill, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';

import {
    candidateEquipment, maxReachableGrade, maxReachableQuality, satisfyingEquipment
} from './oracle.facets';
import {
    blessingLabel, gradeName, joinHuman, MIN_LEVEL, OracleFilters, OutcomeCeilings, resolveQuery,
    subjectIdentity, subjectOf, wasNarrowed
} from './oracle.logic';
import { gradeTextStyle, QualityChips, SubjectIcon } from './querySubject';

import type { MatchedOutcome } from '@shared/api/endpoints/junkToGuarantee.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

interface QuerySummaryProps {
  filters: OracleFilters,
  /** The query resolved against this junk; null while the request is in flight or failed. */
  matched: MatchedOutcome | null,
}

/**
 * Captions a junk's numbers with the criteria that produced them, so the modal reads
 * as an answer to a question rather than a bare count — and survives being screenshotted
 * into a Discord thread.
 *
 * `matched` is the query resolved against *this* junk, so we describe what it can
 * actually give the player rather than replaying the raw filters: quality levels it
 * can't roll, equipment it doesn't drop, and pieces that can't carry the required
 * blessings are all already gone. Losing that (a failed request) degrades to the raw
 * query, which is still true — just less specific.
 *
 * Reads as the second thing on the card, after the crimson junk count: no accent
 * colour of its own beyond the grade tint on the subject.
 */
export function QuerySummary({ filters, matched }: QuerySummaryProps) {
  const strings = useStrings();
  const [expanded, setExpanded] = useState(false);
  const { equipment } = useDetail();

  const query = resolveQuery(matched, filters);

  // A named piece knows its own category/rank, so the icon reads them off the
  // reference list rather than off the (coarser) filter axes — and the subject
  // resolves each name key to its locale display name from the same list.
  const equipmentByName = useMemo(() => {
    const map = new Map<string, EquipmentListItem>();
    for (const item of equipment ?? []) {
      map.set(item.name, item);
    }
    return map;
  }, [equipment]);
  const subject = subjectOf(query, equipmentByName);

  // The ceiling the quality/grade sliders showed for this query — the best any
  // junk could reach across the admitted gear. A result junk that falls short of
  // it lost the player real headroom; one that hits it only tells them what the
  // sliders already did. Read off junk-droppable gear (the picker's own set), so a
  // non-junk piece's unknown ceiling can't inflate it.
  const ceilings = useMemo<OutcomeCeilings>(() => {
    const junkGear = (equipment ?? []).filter((item) => item.sources.length > 0);
    // No catalog yet ⇒ we can't know the ceiling, so don't infer a level cap
    // (MIN_LEVEL suppresses it); identity narrowing still stands on its own.
    if (junkGear.length === 0) {
      return { quality: MIN_LEVEL, grade: MIN_LEVEL };
    }
    const candidates = candidateEquipment(junkGear, filters);
    const satisfying = satisfyingEquipment(candidates, filters.blessings);
    return {
      quality: maxReachableQuality(satisfying),
      grade: maxReachableGrade(satisfying),
    };
  }, [equipment, filters]);
  const narrowed = wasNarrowed(matched, filters, ceilings);

  const identity = subjectIdentity(query, equipmentByName);

  const gradeNames = query.grade.map(gradeName);
  const showSubjectFull = expanded && subject.hidden.length > 0;
  // The expanded view spells out every name — resolved to display names, matching
  // the collapsed `subject.text`, rather than leaking the English keys.
  const fullSubject = query.equipment.map((name) => equipmentByName.get(name)?.displayName ?? name);
  const subjectText = showSubjectFull ? joinHuman(fullSubject, 'or') : subject.text;

  const hasQuality = query.quality.length > 0;
  const hasBlessings = query.blessings.length > 0;

  // Recessed, not raised: a fill *darker* than the modal body reads as an inset well
  // the eye skims past, where a lighter one would compete with the crimson count
  // below. The hairline border keeps it from dissolving into the modal.
  return (
    <Paper
      radius="md"
      p="sm"
      withBorder
      bg="var(--mantine-color-dark-8)"
    >
      <Stack gap={8} align="center">
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <SubjectIcon identity={identity} />
          {/* A div, not the default <p>: the "+N more" affordance is a <button>.
              `ta` isn't redundant with the Stack's centring: once the subject is long
              enough to wrap, this box fills the card and its lines rag left. */}
          <Text component="div" fz="md" ta="center" style={{ minWidth: 0 }}>
            <Tooltip
              label={gradeNames.length ? strings.oracle.gradeTooltipLabel(joinHuman(gradeNames, 'or')) : ''}
              disabled={gradeNames.length === 0}
              withArrow
            >
              <Text
                span
                fw={500}
                style={gradeTextStyle(query.grade)}
                aria-label={gradeNames.length ? strings.oracle.gradeTooltipLabel(joinHuman(gradeNames, 'or')) : undefined}
              >
                {subjectText}
              </Text>
            </Tooltip>
            {!expanded && subject.hidden.length > 0 && (
              <UnstyledButton
                onClick={() => setExpanded(true)}
                ml={6}
                style={{ verticalAlign: 'baseline' }}
              >
                <Text span c="dimmed" fz="sm" td="underline">
                  {strings.common.moreCount(subject.hidden.length)}
                </Text>
              </UnstyledButton>
            )}
          </Text>
        </Group>

        {(hasQuality || hasBlessings) && (
          <Group gap="xs" wrap="wrap">
            {hasQuality && (
              <Tooltip label={strings.oracle.qualityListTooltip} withArrow openDelay={300}>
                <Group gap={4} wrap="nowrap">
                  <QualityChips values={query.quality} />
                </Group>
              </Tooltip>
            )}

            {hasQuality && hasBlessings && (
              <Divider orientation="vertical" />
            )}

            {hasBlessings && (
              <Tooltip label={strings.oracle.mustCarryAllTooltip} withArrow openDelay={300}>
                <Group gap={4} wrap="wrap">
                  {query.blessings.map((code, index) => (
                    <Group key={code} gap={4} wrap="nowrap">
                      {index > 0 && <Text span c="dimmed" fz="sm">+</Text>}
                      <Pill>{blessingLabel(code)}</Pill>
                    </Group>
                  ))}
                </Group>
              </Tooltip>
            )}
          </Group>
        )}

        {narrowed && (
          <Text c="dimmed" fz="xs">
            {strings.oracle.narrowedNote}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
