'use client';

import { useEffect, useMemo, useState } from 'react';

import { useDetail } from '@/components/detail/DetailProvider';
import { wizda } from '@/mascot/voice';
import { api } from '@/services/api';
import { Box, Collapse, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core';

import { blessingLabel, resolvedQueryFrom, subjectIdentity, subjectOf } from './oracle.logic';
import { gradeTextStyle, QualityChips, SubjectIcon } from './querySubject';

import type { GuaranteeFilters } from '@shared/api/endpoints/junkToGuarantee.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
import type { PopularQueryEntry } from '@shared/api/endpoints/popular.models';

/** How many of the most-searched combos to offer. */
const POPULAR_LIMIT = 5;

interface PopularQueriesProps {
  /** Replay a stored query — hands back the combo's accepted-outcome filters. */
  onPick: (filters: GuaranteeFilters) => void,
}

interface PopularRowProps {
  entry: PopularQueryEntry,
  equipmentByName: Map<string, EquipmentListItem>,
  onPick: (filters: GuaranteeFilters) => void,
  /** Position in the list — staggers this row's entrance behind the one above it. */
  index: number,
}

/** How long each row waits behind its predecessor before fading up (ms). */
const ROW_STAGGER_MS = 70;

/**
 * The blessing line's leading, tighter than the body default (1.55), because five
 * rows have to share one screen. Buys ~3px back without shrinking the type.
 *
 * Only the blessings run this snug. They're a glanceable tail of short codes sitting
 * under the quality, where loose leading reads as drift rather than breathing room;
 * the subject beside them is a real name that has to stay comfortable to read, and
 * keeps the default.
 */
const BLESSINGS_LINE_HEIGHT = 1.3;

/** How long the block takes to grow to full height — and the prompt to glide up (ms). */
const REVEAL_DURATION_MS = 320;

/**
 * Two lines of subject, then a hard stop. A stored query can name a fistful of
 * pieces, and `subjectOf`'s "+N more" only caps how many are *listed* — the names
 * themselves are long enough that three of them still overrun a row.
 */
const TWO_LINE_CLAMP: React.CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

/**
 * One stored query, drawn in the same vocabulary a result's `QuerySummary` uses —
 * rank-tinted category icon, grade-coloured subject, quality stars — but laid out
 * as a row: what's being hunted on the left, what shape it has to be on the right.
 *
 * Two departures from the summary, both forced by the row's width. The subject's
 * overflow is plain text, not `QuerySummary`'s "+N more" button — the whole row is
 * already a click target, and a button inside a button is neither valid nor
 * operable. And the blessings are dot-joined text rather than pills, because a row
 * of pills can only be *clipped* mid-pill, never ellipsised.
 */
function PopularRow({ entry, equipmentByName, onPick, index }: PopularRowProps) {
  const query = resolvedQueryFrom(entry.filters);
  const subject = subjectOf(query);
  const identity = subjectIdentity(query, equipmentByName);

  const hasMeta = query.quality.length > 0 || query.blessings.length > 0;

  return (
    <UnstyledButton
      w="100%"
      onClick={() => onPick(entry.filters)}
      className="wizda-fade-up"
      style={{ animationDelay: `${index * ROW_STAGGER_MS}ms` }}
    >
      {/* Tighter vertically than horizontally: five of these have to sit on one screen
          together, and the row's height is the scarce axis, not its width. */}
      <Paper withBorder px="xs" py={6} radius="md" className="wizda-row-hover">
        <Group wrap="nowrap" align="center" gap="sm">
          {/* What they're hunting — takes whatever the right column doesn't want. */}
          <Group gap={8} wrap="nowrap" align="flex-start" style={{ flex: '1 1 auto', minWidth: 0 }}>
            <SubjectIcon identity={identity} />
            <Text component="div" fz="sm" style={{ minWidth: 0, ...TWO_LINE_CLAMP }}>
              <Text span fw={500} style={gradeTextStyle(query.grade)}>
                {subject.text}
              </Text>
              {subject.hidden.length > 0 && (
                <Text span c="dimmed" fz="xs" ml={6}>
                  +{subject.hidden.length} more
                </Text>
              )}
            </Text>
          </Group>

          {/* What it has to roll. Omitted entirely when the query says nothing about
              either, so the subject gets the whole row rather than half of it.

              `0 1 auto` — never grow, shrink when pressed, sized by its own content.
              A zero basis (plain `flex: 2`) would claim a fixed share of every row and
              strand it in whitespace on a wide screen; an auto basis means a short
              blessing list simply takes a short column.

              The bounds are what the ellipsis bites at: the floor keeps a lone quality
              from squeezing the column to nothing (and still allows shrinking — it only
              replaces the default `min-width: auto`, which would refuse to shrink below
              the content at all), and the cap stops a long blessing list from crowding
              out the subject. */}
          {hasMeta && (
            <Stack gap={2} align="flex-end" style={{ flex: '0 1 auto', minWidth: 70, maxWidth: '45%' }}>
              <QualityChips values={query.quality} />
              {query.blessings.length > 0 && (
                <Text c="dimmed" fz="xs" lh={BLESSINGS_LINE_HEIGHT} truncate ta="right" w="100%">
                  {query.blessings.map(blessingLabel).join(' · ')}
                </Text>
              )}
            </Stack>
          )}
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

/**
 * The most-searched Junk Oracle queries, offered as one-tap starting points for a
 * player who hasn't decided what to hunt yet.
 *
 * Certainty is deliberately absent: it isn't part of what makes two searches "the
 * same hunt" (see `recordPopularQuery`), so replaying one keeps whatever certainty
 * the player already has set.
 *
 * Every failure here is silent — no data yet, a failed request, an empty table all
 * render nothing. This is a nudge for the undecided, not a feature the page owes
 * anyone; a broken one should cost the empty state nothing but its own absence.
 */
export function PopularQueries({ onPick }: PopularQueriesProps) {
  const [entries, setEntries] = useState<PopularQueryEntry[]>([]);
  // Drives the reveal, and is deliberately a beat behind `entries`. Collapse only
  // animates a false→true flip, so opening in the same commit the rows arrive in
  // would mount it already-open and the block would simply appear — the snap we're
  // here to remove. The extra frame is what gives it somewhere to animate from.
  const [open, setOpen] = useState(false);
  const { equipment } = useDetail();

  useEffect(() => {
    let cancelled = false;
    api.popular()
      .then((result) => {
        if (!cancelled) {
          setEntries(result.queries.slice(0, POPULAR_LIMIT));
        }
      })
      .catch(() => { /* a nudge that never loads is just no nudge */ });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (entries.length === 0) {
      return;
    }
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [entries]);

  const equipmentByName = useMemo(() => {
    const map = new Map<string, EquipmentListItem>();
    for (const item of equipment ?? []) {
      map.set(item.name, item);
    }
    return map;
  }, [equipment]);

  // Still nothing to offer: render nothing at all rather than a collapsed shell, so
  // the empty state keeps its own spacing (a zero-height child would still draw its
  // parent's flex gap).
  if (entries.length === 0) {
    return null;
  }

  // Collapse grows from nothing to the block's natural height, and the centred empty
  // state re-lays out on every frame of it — which is what carries Wizda's prompt up
  // smoothly instead of teleporting it. The margin rides inside, so it arrives with
  // the block rather than being reserved ahead of it.
  return (
    <Box w="100%">
      <Collapse in={open} transitionDuration={REVEAL_DURATION_MS}>
        <Stack gap="xs" mt="xs">
          <Text className="wizda-speech wizda-speech-muted" c="dimmed" fz="sm" ta="center">
            {wizda.oracle.popularHeading}
          </Text>
          {entries.map((entry, index) => (
            // The filters *are* the combo's identity — the backend already de-duped on
            // exactly this (see `canonicalizeFilters`), so no two rows can collide.
            <PopularRow
              key={JSON.stringify(entry.filters)}
              entry={entry}
              equipmentByName={equipmentByName}
              onPick={onPick}
              index={index}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
