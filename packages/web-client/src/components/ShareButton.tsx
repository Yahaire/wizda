'use client';

import { useEffect } from 'react';

import { useStrings, useWizda } from '@/i18n/LanguageProvider';
import { wizdaSay } from '@/mascot/wizda';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { IconCheck, IconShare } from '@tabler/icons-react';

/**
 * Whether handing off to the OS share sheet beats copying — a question about
 * the *device*, not just about API availability.
 *
 * `navigator.share` also exists on desktop Safari and Chrome/Edge on Windows,
 * but there it's the wrong call: the URL is already sitting in the address bar,
 * so the sheet solves nothing, while being a slow, heavyweight OS modal most
 * desktop users have never seen. On a phone that inverts — the address bar is
 * hidden or truncated, copying is fiddly, and the sheet is the fast path into
 * LINE or Discord.
 *
 * `(pointer: coarse)` asks the platform whether the *primary* input is a
 * finger, which is exactly the question, and is why this isn't UA sniffing: a
 * touchscreen Windows laptop reports `fine` (it has a mouse) and gets the copy,
 * while a tablet reports `coarse` and gets the sheet. Evaluated per click
 * rather than at render, so there's no hydration mismatch and a convertible
 * flipping into tablet mode is picked up straight away.
 */
function prefersShareSheet(): boolean {
  return (
    typeof navigator.share === 'function'
    && window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Hands the current page's URL to someone else — including any `?q=` search a
 * list view has mirrored into it (see `useSearchQueryParam`).
 *
 * Two paths (see {@link prefersShareSheet} for which runs where):
 *
 * - **The OS share sheet**, on touch-primary devices. It puts a junk search
 *   straight into LINE, Discord or X, which is how these links actually travel.
 *   The sheet is its own feedback, so we say nothing after it.
 * - **Clipboard copy** everywhere else, confirmed by the check-mark swap *and*
 *   a Wizda toast — the toast being the only feedback that reaches a phone,
 *   where there is no hover and so no tooltip.
 *
 * Wizda's line is deliberately state-neutral: this same button sits on the
 * Oracle, whose URL doesn't yet encode the calculator's picks, so the toast
 * never claims to have copied a search.
 */
export function ShareButton() {
  const strings = useStrings();
  const wizda = useWizda();
  const clipboard = useClipboard({ timeout: 1500 });

  // `useClipboard().copy()` is fire-and-forget — it flips `copied`/`error` once
  // the write settles — so the toast is driven off those transitions rather
  // than off the click handler.
  useEffect(() => {
    if (clipboard.copied) {
      wizdaSay(wizda.share.copied);
    }
  }, [clipboard.copied, wizda]);

  useEffect(() => {
    if (clipboard.error) {
      wizdaSay(wizda.share.failed);
    }
  }, [clipboard.error, wizda]);

  const handleClick = () => {
    const url = window.location.href;

    if (!prefersShareSheet()) {
      clipboard.copy(url);
      return;
    }

    // Called synchronously off the click: `navigator.share` needs the gesture's
    // transient activation, and anything awaited before this point spends it.
    // `title` rides along as the localized `<title>` the route already set.
    // Deliberately no `text` — several targets concatenate it with the URL and
    // make a mess of the link.
    navigator.share({ title: document.title, url }).catch((error: unknown) => {
      // Dismissing the sheet rejects with AbortError. That's a deliberate "no
      // thanks", not a failure — never nag about it, and never fall back to
      // copying, which would leave them with a link they just declined to send.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      clipboard.copy(url);
    });
  };

  return (
    <Tooltip label={strings.common.shareLabel} position="bottom" withArrow openDelay={400}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        onClick={handleClick}
        aria-label={strings.common.shareLabel}
      >
        {clipboard.copied ? <IconCheck size={18} /> : <IconShare size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
