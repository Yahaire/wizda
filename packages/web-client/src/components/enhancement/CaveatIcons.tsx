'use client';

import { useStrings } from '@/i18n/LanguageProvider';
import { Group, ThemeIcon, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

interface CaveatIconsProps {
  /** `initialGrade` left at "Not sure" — inert on the odds, a reassurance rather than a warning. */
  gradeUnknown: boolean,
  /** An alteration is declared but its original blessing isn't — a real precision caveat. */
  alteredOriginUnknown: boolean,
}

/**
 * The two accuracy caveats, rendered identically wherever they're shown —
 * beside the Calculate button (before running the query) and again inside
 * `EnhancementResult.tsx`'s header (so the caveat travels with the number it
 * affects). Both spots pass the same two booleans, computed once from form
 * state, so the two placements can't drift into different wording. See
 * `new-tool-plan.md` Milestone 4, "The accuracy heads-up".
 *
 * The two are deliberately *not* the same colour: a grade left at "Not sure"
 * costs nothing (confirmed inert in `docs/calculation/enhancement.md`), so it
 * gets a neutral info icon rather than an alarm.
 */
export function CaveatIcons({ gradeUnknown, alteredOriginUnknown }: CaveatIconsProps) {
  const strings = useStrings();

  if (!gradeUnknown && !alteredOriginUnknown) {
    return null;
  }

  return (
    <Group gap={6} wrap="nowrap">
      {gradeUnknown && (
        <Tooltip label={strings.enhancement.gradeUnknownTooltip} withArrow multiline w={240}>
          <ThemeIcon variant="subtle" color="blue" size="sm" radius="xl">
            <IconInfoCircle size={16} />
          </ThemeIcon>
        </Tooltip>
      )}
      {alteredOriginUnknown && (
        <Tooltip label={strings.enhancement.alteredOriginUnknownTooltip} withArrow multiline w={240}>
          <ThemeIcon variant="subtle" color="yellow" size="sm" radius="xl">
            <IconAlertTriangle size={16} />
          </ThemeIcon>
        </Tooltip>
      )}
    </Group>
  );
}
