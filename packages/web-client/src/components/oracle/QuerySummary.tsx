'use client';

import { useId, useMemo, useState } from 'react';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { useDetail } from '@/components/detail/DetailProvider';
import {
    getRankColor, GRADE_HEX, QualityStarRow, QualityStars
} from '@/components/gear/gearDisplays';
import { Divider, Group, Paper, Pill, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconTarget } from '@tabler/icons-react';

import {
    blessingLabel, gradeName, joinHuman, OracleFilters, qualityDisplay, resolveQuery, subjectIdentity,
    SubjectIdentity, subjectOf, wasNarrowed
} from './oracle.logic';

import type { MatchedOutcome } from '@shared/api/endpoints/junkToGuarantee.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

interface QuerySummaryProps {
  filters: OracleFilters,
  /** The query resolved against this junk; null while the request is in flight or failed. */
  matched: MatchedOutcome | null,
}

/**
 * Paint the subject in its grade colour, the way the game paints item names. Several
 * accepted grades split the text evenly between them with hard stops — a letter on a
 * boundary goes two-tone, which reads as deliberate. No grade filter leaves the text
 * at its normal colour.
 */
function gradeTextStyle(grades: number[]): React.CSSProperties {
  if (grades.length === 0) {
    return {};
  }
  if (grades.length === 1) {
    return { color: GRADE_HEX[grades[0]!] };
  }
  const stops = grades.map((grade, index) => {
    const from = (index / grades.length) * 100;
    const to = ((index + 1) / grades.length) * 100;
    return `${GRADE_HEX[grade]} ${from}% ${to}%`;
  });
  return {
    backgroundImage: `linear-gradient(90deg, ${stops.join(', ')})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    // Both: `color` for the standard property, `-webkit-text-fill-color` because
    // WebKit paints the glyph fill from that and would otherwise ignore the clip.
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };
}

const SUBJECT_ICON_SIZE = 18;

/**
 * The subject's icon: its category's shape, tinted by its rank — the two facts a
 * player reads off an item at a glance in-game.
 *
 * Falls back to a neutral target whenever the query covers more than one shape, since
 * no single icon can stand for "an axe or a robe". Several ranks still tint, though:
 * `color` reaches an SVG paint attribute in both icon families (Tabler's stroke, a
 * game-icon's fill — see `gameIcon`), so an SVG gradient works as a paint server
 * there exactly as `background-clip: text` does for the subject text.
 */
function SubjectIcon({ identity }: { identity: SubjectIdentity }) {
  // `useId` embeds colons, which can't appear in a `url(#…)` fragment reference.
  const gradientId = `rank-${useId().replace(/:/g, '')}`;

  const Icon = identity.categoryCode
    ? getCategoryIcon(identity.categoryCode)
    : IconTarget;

  const colors = identity.rankKinds
    .map(getRankColor)
    .filter((color): color is string => Boolean(color));

  const iconStyle = { flexShrink: 0, marginTop: 2 };
  if (colors.length === 0) {
    return (
      <Icon
        size={SUBJECT_ICON_SIZE}
        color="var(--mantine-color-dimmed)"
        className="wizda-icon-outline"
        style={iconStyle}
      />
    );
  }
  if (colors.length === 1) {
    return (
      <Icon
        size={SUBJECT_ICON_SIZE}
        color={colors[0]}
        className="wizda-icon-outline"
        style={iconStyle}
      />
    );
  }
  return (
    <>
      <svg width={0} height={0} aria-hidden style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {colors.flatMap((color, index) => [
              <stop key={`${color}-from`} offset={`${(index / colors.length) * 100}%`} stopColor={color} />,
              <stop key={`${color}-to`} offset={`${((index + 1) / colors.length) * 100}%`} stopColor={color} />,
            ])}
          </linearGradient>
        </defs>
      </svg>
      <Icon
        size={SUBJECT_ICON_SIZE}
        color={`url(#${gradientId})`}
        className="wizda-icon-outline"
        style={iconStyle}
      />
    </>
  );
}

/** A dim separator between compact quality levels: "3★/4★", "2★–4★". */
function QualitySeparator({ children }: { children: string }) {
  return <Text span c="dimmed" fz="sm">{children}</Text>;
}

/** The accepted quality levels — written stars for one, compact notation for several. */
function QualityChips({ values }: { values: number[] }) {
  const display = qualityDisplay(values);
  if (!display) {
    return null;
  }
  if (display.kind === 'stars') {
    return <QualityStarRow value={display.value} />;
  }
  if (display.kind === 'range') {
    return (
      <Group gap={4} wrap="nowrap">
        <QualityStars value={display.from} />
        <QualitySeparator>–</QualitySeparator>
        <QualityStars value={display.to} />
      </Group>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      {display.values.map((value, index) => (
        <Group key={value} gap={4} wrap="nowrap">
          {index > 0 && <QualitySeparator>/</QualitySeparator>}
          <QualityStars value={value} />
        </Group>
      ))}
    </Group>
  );
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
  const [expanded, setExpanded] = useState(false);
  const { equipment } = useDetail();

  const query = resolveQuery(matched, filters);
  const subject = subjectOf(query);
  const narrowed = wasNarrowed(matched, filters);

  // A named piece knows its own category/rank, so the icon reads them off the
  // reference list rather than off the (coarser) filter axes.
  const equipmentByName = useMemo(() => {
    const map = new Map<string, EquipmentListItem>();
    for (const item of equipment ?? []) {
      map.set(item.name, item);
    }
    return map;
  }, [equipment]);
  const identity = subjectIdentity(query, equipmentByName);

  const gradeNames = query.grade.map(gradeName);
  const showSubjectFull = expanded && subject.hidden.length > 0;
  const subjectText = showSubjectFull ? joinHuman(query.equipment, 'or') : subject.text;

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
              label={gradeNames.length ? `Grade: ${joinHuman(gradeNames, 'or')}` : ''}
              disabled={gradeNames.length === 0}
              withArrow
            >
              <Text
                span
                fw={500}
                style={gradeTextStyle(query.grade)}
                aria-label={gradeNames.length ? `${subjectText}, ${joinHuman(gradeNames, 'or')} grade` : undefined}
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
                  +{subject.hidden.length} more
                </Text>
              </UnstyledButton>
            )}
          </Text>
        </Group>

        {(hasQuality || hasBlessings) && (
          <Group gap="xs" wrap="wrap">
            {hasQuality && (
              <Tooltip label="Any of these quality levels" withArrow openDelay={300}>
                <Group gap={4} wrap="nowrap">
                  <QualityChips values={query.quality} />
                </Group>
              </Tooltip>
            )}

            {hasQuality && hasBlessings && (
              <Divider orientation="vertical" />
            )}

            {hasBlessings && (
              <Tooltip label="Must carry all of these" withArrow openDelay={300}>
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
            Trimmed to what this junk actually drops.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
