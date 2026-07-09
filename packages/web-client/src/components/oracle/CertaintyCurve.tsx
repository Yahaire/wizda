'use client';

import { Box, Group, Stack, Text } from '@mantine/core';

import { formatCertaintyPct } from './oracle.logic';

import type { CertaintyCurvePoint } from '@shared/api/endpoints/junkToGuarantee.models';

const PCT_COL = 60;
// Wide enough for a five-digit count at the selected row's larger type.
const NEEDED_COL = 84;
const BAR_HEIGHT = 10;

/** Row height of the selected row, which sets the tallest line — used for the loader. */
export const CURVE_ROW_HEIGHT = 30;

interface CertaintyCurveProps {
  /** One point per entry of {@link percents}, in the same order. */
  points: CertaintyCurvePoint[],
  /** The certainty levels charted, ascending (see `certaintyWindow`). */
  percents: number[],
  /** The certainty the player picked — the highlighted row in the window. */
  selectedPct: number,
}

/**
 * A compact three-point view of how much junk is needed as the target certainty moves
 * a step either side of the player's pick — a tiny bar chart that makes the cost of
 * chasing more certainty tangible. The selected level is the star of the modal: crimson
 * and a size up, so it wins the eye before anything else on the card.
 *
 * Presentational — the owning modal fetches the curve, since the same response also
 * carries the resolved match set the summary needs.
 */
export function CertaintyCurve({
  points,
  percents,
  selectedPct,
}: CertaintyCurveProps) {
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
          <Group key={pct} gap="sm" wrap="nowrap" align="center" mih={CURVE_ROW_HEIGHT}>
            <Text
              size={selected ? 'md' : 'sm'}
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
              size={selected ? undefined : 'sm'}
              fz={selected ? '1.25rem' : undefined}
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
