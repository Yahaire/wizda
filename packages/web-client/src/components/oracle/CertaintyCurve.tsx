'use client';

import { useEffect, useMemo, useState } from 'react';

import { Box, Center, Group, Loader, Stack, Text } from '@mantine/core';

import { certaintyWindow, formatCertaintyPct } from './oracle.logic';

import type {
  CertaintyCurvePoint,
  CertaintyCurveResult,
} from '@shared/api/endpoints/junkToGuarantee.models';

const PCT_COL = 60;
const NEEDED_COL = 76;
const BAR_HEIGHT = 10;

interface CertaintyCurveProps {
  junkName: string,
  /** The certainty the player picked — the highlighted row in the window. */
  selectedPct: number,
  /** Fetches the curve for the given junk across the requested certainties (fractions). */
  onRequestCurve: (junkName: string, certainties: number[]) => Promise<CertaintyCurveResult>,
}

/**
 * A compact three-point view of how much junk is needed as the target certainty
 * moves a step either side of the player's pick — a tiny bar chart that makes the
 * cost of chasing more certainty tangible. The selected level is highlighted.
 */
export function CertaintyCurve({
  junkName,
  selectedPct,
  onRequestCurve,
}: CertaintyCurveProps) {
  const percents = useMemo(() => certaintyWindow(selectedPct), [selectedPct]);
  const [points, setPoints] = useState<CertaintyCurvePoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setFailed(false);
    onRequestCurve(junkName, percents.map((pct) => pct / 100))
      .then((result) => {
        if (!cancelled) {
          setPoints(result.points);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [junkName, percents, onRequestCurve]);

  if (failed) {
    return (
      <Text size="sm" c="dimmed">
        Couldn&apos;t work out the certainty curve — the single number above still stands.
      </Text>
    );
  }

  if (!points) {
    return (
      <Center h={3 * (BAR_HEIGHT + 14)}>
        <Loader size="sm" color="crimson" />
      </Center>
    );
  }

  const maxNeeded = Math.max(1, ...points.map((point) => point.junkNeeded ?? 0));

  return (
    <Stack gap="xs">
      {points.map((point, index) => {
        const pct = percents[index]!;
        const selected = Math.abs(pct - selectedPct) < 1e-9;
        const needed = point.junkNeeded;
        // Give a non-zero bar a visible minimum so the smallest count still reads.
        const width = needed ? Math.max((needed / maxNeeded) * 100, 4) : 0;
        return (
          <Group key={pct} gap="sm" wrap="nowrap" align="center">
            <Text
              size="sm"
              w={PCT_COL}
              ta="right"
              fw={selected ? 700 : 400}
              c={selected ? undefined : 'dimmed'}
            >
              {formatCertaintyPct(pct)}
            </Text>
            <Box
              flex={1}
              h={BAR_HEIGHT}
              style={{
                borderRadius: BAR_HEIGHT,
                overflow: 'hidden',
                backgroundColor: 'var(--mantine-color-default-border)',
              }}
            >
              <Box
                h="100%"
                style={{
                  width: `${width}%`,
                  borderRadius: BAR_HEIGHT,
                  backgroundColor: selected
                    ? 'var(--mantine-color-crimson-5)'
                    : 'var(--mantine-color-gray-5)',
                  transition: 'width 220ms ease',
                }}
              />
            </Box>
            <Text
              size="sm"
              w={NEEDED_COL}
              ta="right"
              fw={selected ? 700 : 500}
              c={selected ? 'crimson.4' : undefined}
            >
              {needed === null ? '—' : needed.toLocaleString()}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );
}
