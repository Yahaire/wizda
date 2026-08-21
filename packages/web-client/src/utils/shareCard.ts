/**
 * Rasterizes the junk share card to a PNG and hands it to whichever delivery
 * mechanism the device supports — the image half of `docs/sharing.md`'s
 * sharing story, for a query too specific (or too large) to always ride in a
 * URL, and for the platforms (Discord, a Reddit post) where a picture is what
 * actually gets seen.
 *
 * The picture itself is real DOM: {@link JunkShareCard} composes the detail
 * modal's own components, mounted off-screen, and this module only turns that
 * subtree into pixels. That is the whole point — the alternative (a hand-drawn
 * `<canvas>`, which this used to be) means a second renderer that silently
 * drifts from the theme every time a colour or a size changes on screen.
 *
 * Rasterizing arbitrary DOM has no native browser API; `html-to-image` does it
 * by cloning the node with its computed styles inlined into an
 * `<svg><foreignObject>` and drawing that to a canvas. Two consequences worth
 * knowing before touching this:
 *
 * - **Nothing is fetched during rasterization.** Fonts have to be inlined as
 *   `data:` URIs up front, which {@link fontEmbedCss} does once per session.
 *   Images would need the same treatment — the card gets away with none of that
 *   because every icon on it is an inline SVG component (Tabler / game-icons),
 *   not an `<img>`. Keep it that way.
 * - **The card must be laid out, not hidden.** `display: none` and
 *   `visibility: hidden` both propagate into the cloned computed styles and
 *   produce an empty image; {@link SHARE_CARD_OFFSCREEN_STYLE} parks it out of
 *   view instead.
 */

import { getFontEmbedCSS, toBlob } from 'html-to-image';

import { prefersShareSheet } from '@/components/ShareButton';

/**
 * Scales the card up at rasterization time rather than laying it out larger —
 * 560 CSS px becomes a 1680px-wide PNG, sharp on a high-DPI phone screen (the
 * far likelier place a shared image gets viewed) with no second set of sizes to
 * maintain.
 */
const SHARE_CARD_PIXEL_RATIO = 3;

/** `dark[9]` from `theme.ts` — the card's own background, restated for the flattened PNG. */
const SHARE_CARD_BACKGROUND = '#0a0908';

/**
 * Parks the card where it is fully laid out but never seen or interacted with.
 *
 * `position: fixed` keeps it out of the modal's flow, the far-left offset keeps
 * it off-screen without `display`/`visibility` (see the module doc), and
 * `aria-hidden` plus `pointer-events: none` keep it out of the accessibility
 * tree and out of the way of clicks.
 */
export const SHARE_CARD_OFFSCREEN_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: -10_000,
  pointerEvents: 'none',
};

/**
 * The app's webfonts inlined as `data:` URIs, resolved once and reused.
 *
 * `next/font` self-hosts, so these are same-origin and always fetchable; the
 * result is a few hundred KB of base64 that would otherwise be re-fetched and
 * re-encoded on every share. A failure here is not fatal — the card falls back
 * to whatever system fonts the rasterizer can resolve locally, which is also
 * what Japanese text uses either way (neither Cinzel nor Inter covers it).
 */
let fontEmbedCss: Promise<string> | null = null;

function getFontEmbedCss(node: HTMLElement): Promise<string> {
  fontEmbedCss ??= getFontEmbedCSS(node).catch(() => '');
  return fontEmbedCss;
}

/**
 * Draws `card` to a PNG blob. Throws if rasterization fails outright.
 *
 * Runs the capture twice and keeps the second result. WebKit is the reason:
 * its first `foreignObject` rasterization of a subtree routinely lands before
 * the embedded `@font-face` rules have been applied, yielding a card in
 * fallback type (or, occasionally, with text missing altogether). The second
 * pass reuses the cached font CSS and the browser's now-warm layout, so it
 * costs little — and this runs behind a deliberate user action with a toast at
 * the end of it, where a hundred extra milliseconds is invisible.
 */
export async function renderJunkDetailCard(card: HTMLElement): Promise<Blob> {
  const options = {
    pixelRatio: SHARE_CARD_PIXEL_RATIO,
    backgroundColor: SHARE_CARD_BACKGROUND,
    fontEmbedCSS: await getFontEmbedCss(card),
    // Every asset is inline already, so there is nothing to defeat a cache on —
    // and the query strings it appends would only break the `data:` URIs above.
    cacheBust: false,
  };

  await toBlob(card, options);
  const blob = await toBlob(card, options);
  if (!blob) {
    throw new Error('html-to-image returned no blob for the share card');
  }
  return blob;
}

export type ImageDeliveryMethod = 'share' | 'clipboard' | 'download';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Hands `blob` to whichever the device can actually do, in order:
 *
 * 1. The OS share sheet, on a touch-primary device that can share files (Web
 *    Share Level 2 — not universal even where `navigator.share` itself is).
 *    Its own UI is the feedback, so this reports `'share'` and the caller
 *    stays quiet, same as `ShareButton`'s link flow.
 * 2. The clipboard, everywhere else — Discord and Reddit both accept a
 *    pasted image directly.
 * 3. A plain download, if even the clipboard write is unavailable or denied.
 *
 * Dismissing the share sheet (`AbortError`) is a deliberate "no thanks", not
 * a failure — reported as `'share'` too, never falling through to the other
 * two (which would hand them a copy/download of something they just declined
 * to send, mirroring `ShareButton`'s own AbortError handling).
 */
export async function deliverJunkDetailImage(
  blob: Blob,
  options: { title: string, filename: string },
): Promise<ImageDeliveryMethod> {
  const file = new File([blob], options.filename, { type: 'image/png' });

  if (prefersShareSheet() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: options.title });
      return 'share';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'share';
      }
      // Fall through to the clipboard/download paths below.
    }
  }

  if (typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'clipboard';
    } catch {
      // Fall through to the download path below.
    }
  }

  downloadBlob(blob, options.filename);
  return 'download';
}
