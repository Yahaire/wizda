'use client';

import { useId } from 'react';

import { getCategoryIcon } from '@/components/CategoryIcon';
import { getRankColor, GRADE_HEX, QualityStarRow, QualityStars } from '@/components/gear/gearDisplays';
import { Group, Text } from '@mantine/core';
import { IconTarget } from '@tabler/icons-react';

import { qualityDisplay, SubjectIdentity } from './oracle.logic';

/**
 * How a query's subject is drawn — the shared vocabulary behind both the results
 * detail summary (`QuerySummary`) and the popular-search rows (`PopularQueries`).
 *
 * These live here rather than in `components/gear/gearDisplays` because they speak
 * in Oracle terms (`SubjectIdentity`, a query's level *sets*), and gear's displays
 * are deliberately generic — the dependency only runs one way.
 */

/**
 * Paint the subject in its grade colour, the way the game paints item names. Several
 * accepted grades split the text evenly between them with hard stops — a letter on a
 * boundary goes two-tone, which reads as deliberate. No grade filter leaves the text
 * at its normal colour.
 */
export function gradeTextStyle(grades: number[]): React.CSSProperties {
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

export const SUBJECT_ICON_SIZE = 18;

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
export function SubjectIcon({ identity }: { identity: SubjectIdentity }) {
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
export function QualityChips({ values }: { values: number[] }) {
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
