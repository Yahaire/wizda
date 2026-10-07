'use client';

import { ISSUES_URL } from '@/app/app.constants';
import { useStrings } from '@/i18n/LanguageProvider';
import { Anchor, Badge, Popover, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

/**
 * A "Preview" badge beside the Enhancement Oracle's title that, clicked,
 * explains what preview means here: features still missing, polish pending,
 * and Japanese copy that is machine-translated for now.
 *
 * A popover rather than a tooltip so it opens on tap — a hover-only
 * explanation would be unreachable on the phones most players use. Temporary:
 * delete this component and its `enhancement.preview*` badge strings once the
 * tool leaves preview.
 */
export function PreviewBadge() {
  const strings = useStrings();

  return (
    <Popover width={320} position="bottom-start" withArrow shadow="md">
      <Popover.Target>
        <Badge
          component="button"
          type="button"
          variant="light"
          color="yellow"
          rightSection={<IconInfoCircle size={12} />}
          aria-label={strings.enhancement.previewBadgeAriaLabel}
          style={{ cursor: 'pointer' }}
        >
          {strings.enhancement.previewBadgeLabel}
        </Badge>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text fw={600} size="sm">{strings.enhancement.previewNoticeTitle}</Text>
          {strings.enhancement.previewNoticeParagraphs.map((paragraph) => (
            <Text key={paragraph} size="sm">{paragraph}</Text>
          ))}
          <Anchor href={ISSUES_URL} target="_blank" rel="noopener noreferrer" size="sm">
            {strings.enhancement.previewNoticeFeedbackLink}
          </Anchor>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
