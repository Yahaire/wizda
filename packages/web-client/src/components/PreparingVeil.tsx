'use client';

import { useWizda } from '@/i18n/LanguageProvider';
import { WizdaGlyph } from '@/mascot/wizda';
import { WizdaWait } from '@/mascot/WizdaWait';
import { Box, Paper, Transition } from '@mantine/core';

/**
 * How long the scrim takes to fade off once the wait is over. Long enough to
 * read as a reveal — you watch the controls settle through it — and short
 * enough that a load which was never slow doesn't feel padded.
 */
const EXIT_DURATION_MS = 260;

interface PreparingVeilProps {
  /** True while the wrapped content's state is still arriving. */
  preparing: boolean,
  children: React.ReactNode,
}

/**
 * A translucent "give me a second" scrim laid over content whose state hasn't
 * finished arriving, with Wizda saying as much.
 *
 * It exists because a page can't have its controls right on the first paint:
 * remembered selections hydrate out of `localStorage` in an effect, and a shared
 * link's params are applied in another. Without a cover, a returning player — or
 * anyone opening someone else's link — watches an empty-looking form paint and
 * then rewrite itself, which reads as a broken page rather than a loading one.
 *
 * One treatment covers both sources on purpose: to the player they're the same
 * moment, and two bespoke ones would only be two things to see. It's the same
 * motif as the full-screen "she's stepped out" takeover, too — see
 * {@link WizdaWait}.
 *
 * The wrapper is the positioning context, so whatever is passed as `children`
 * is exactly what gets covered — hand it the block whose state is in question,
 * not the whole page. See `.wizda-veil` in `globals.css` for why it fades out
 * but never in, and why the content sits in a stacking context of its own.
 */
export function PreparingVeil({ preparing, children }: PreparingVeilProps) {
  const wizda = useWizda();

  return (
    <Box pos="relative" aria-busy={preparing}>
      <div className="wizda-veil-content">{children}</div>
      <Transition
        mounted={preparing}
        transition="fade"
        duration={0}
        exitDuration={EXIT_DURATION_MS}
      >
        {(transitionStyle) => (
          <div
            className="wizda-veil"
            style={{
              ...transitionStyle,
              // Released the moment the wait is over rather than when the fade
              // finishes, so the exit animation never costs anyone a click.
              pointerEvents: preparing ? undefined : 'none',
            }}
          >
            {/* Her words need an opaque bed: over the scrim alone they'd be
                reading against whatever controls happen to sit behind them. An
                ordinary card is also what the rest of the page is built from,
                so this lands as one more panel rather than a new idiom. */}
            <Paper withBorder radius="md" shadow="md" px="xl" py="lg" role="status" aria-live="polite">
              <WizdaWait glyph={WizdaGlyph.greet} line={wizda.preparing} size={64} />
            </Paper>
          </div>
        )}
      </Transition>
    </Box>
  );
}
