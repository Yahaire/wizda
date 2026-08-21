'use client';

import { useStrings } from '@/i18n/LanguageProvider';
import { ActionIcon, Menu } from '@mantine/core';
import { IconCheck, IconLink, IconPhoto, IconShare } from '@tabler/icons-react';

import { useShareUrl } from './ShareButton';

interface ShareMenuProps {
  /**
   * Builds and delivers the image (see `shareCard.ts`). The menu shows no
   * loading state of its own while this runs — the card is already mounted and
   * laid out by the time the menu opens, so all that is left is rasterizing it
   * (plus, on the first share of a session, base64-ing the app's webfonts out
   * of the browser's own cache). Wizda's toast, driven by the delivery
   * outcome, is the feedback, same as the link flow below.
   */
  onShareImage: () => void | Promise<void>,
}

/**
 * The junk detail modal's share control: a link (the exact same flow as
 * `ShareButton` everywhere else, via `useShareUrl`) or a shareable/downloadable
 * image (`shareCard.ts`) — see `docs/sharing.md`.
 *
 * Not used anywhere else in the app: every other shareable page has just the
 * one thing worth sharing (the page itself, or a list search) and keeps the
 * plain single-action `ShareButton`. The modal is the one place a static
 * picture is *also* worth offering — a query too specific for a URL alone to
 * carry the moment, and the natural shape for a Reddit post or Discord drop.
 *
 * No tooltip on the trigger (unlike `ShareButton`): opening it reveals two
 * clearly labeled items, so the icon doesn't need to explain itself first.
 */
export function ShareMenu({ onShareImage }: ShareMenuProps) {
  const strings = useStrings();
  const { handleClick: handleShareLink, copied } = useShareUrl();

  return (
    <Menu position="bottom-end" withArrow>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label={strings.common.shareLabel}>
          {copied ? <IconCheck size={18} /> : <IconShare size={18} />}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconLink size={16} />} onClick={handleShareLink}>
          {strings.common.shareLinkLabel}
        </Menu.Item>
        <Menu.Item leftSection={<IconPhoto size={16} />} onClick={() => { void onShareImage(); }}>
          {strings.common.shareImageLabel}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
