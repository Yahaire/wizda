'use client';

import { useStrings } from '@/i18n/LanguageProvider';
import { Group, ThemeIcon, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface CaveatIconsProps {
  /** `initialGrade` left at "Not sure" — inert on the odds, a reassurance rather than a warning. */
  gradeUnknown: boolean,
}

/**
 * The accuracy caveats that travel with a result, rendered inside
 * `EnhancementResult.tsx`'s header so the caveat sits beside the number it
 * concerns. One caveat today: a grade left at "Not sure", which costs nothing
 * (confirmed inert in `docs/calculation/enhancement.md`) and so gets a neutral
 * info icon rather than an alarm. Kept as a group so a real precision caveat,
 * should one ever return, has a home that already knows how to show it.
 */
export function CaveatIcons({ gradeUnknown }: CaveatIconsProps) {
  const strings = useStrings();

  if (!gradeUnknown) {
    return null;
  }

  return (
    <Group gap={6} wrap="nowrap">
      <Tooltip label={strings.enhancement.gradeUnknownTooltip} withArrow multiline w={240}>
        <ThemeIcon variant="subtle" color="blue" size="sm" radius="xl">
          <IconInfoCircle size={16} />
        </ThemeIcon>
      </Tooltip>
    </Group>
  );
}
