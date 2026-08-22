# Sharing

How a Wizda page ends up in someone else's hands — the plain link button every page carries, the Oracle's query-carrying URL, and the junk detail modal's link-or-image menu. For the junk/equipment lists' own `?q=` search link, see [`docs/search.md`](./search.md)'s "Shareable search URLs" — that one is simpler (a single query string, always `replaceState`) and isn't repeated here.

Three surfaces, three files:

| Surface | Where | Owns |
|---|---|---|
| Plain page link | `components/ShareButton.tsx` | the link button on the Oracle and the two list pages, via `PageTitle`'s `shareable` prop (About deliberately has none — nobody sends anyone that page on its own) |
| Oracle query URL | `components/oracle/oracleUrlState.ts` + `hooks/useOracleUrlState.ts` | encoding the calculator's picks into `?equipment=…&rank=…` etc., and the history writes that make Back/Forward walk them |
| Junk detail share menu | `components/ShareMenu.tsx` + `utils/shareCard.ts` + `components/oracle/JunkShareCard.tsx` | the modal's link-or-image choice, and rasterizing the image |

## The link flow

`useShareUrl` (in `ShareButton.tsx`) is the one place "hand this URL to someone else" is implemented; `ShareButton` and `ShareMenu`'s "Link" item both call it rather than each having their own copy.

Two delivery paths, chosen per click by `prefersShareSheet()`:

- **The OS share sheet**, when `navigator.share` exists *and* `(pointer: coarse)` matches — i.e. the primary input is a finger. That's a device question, not a browser-capability one: desktop Safari and Windows Chrome/Edge both expose `navigator.share`, but the sheet would be solving a problem the address bar doesn't have there. `(pointer: coarse)` is evaluated per click rather than cached at render, so a convertible flipping into tablet mode is picked up immediately and there's no hydration mismatch.
- **Clipboard copy** everywhere else, confirmed by the button's check-mark swap and a Wizda toast (`wizda.share.copied`/`.failed`) — the toast is the only feedback that reaches a phone, which has no hover and so no tooltip.

Two decisions worth not relitigating:

- **No `text` in the `navigator.share()` call**, only `title` and `url`. Several share targets concatenate `text` and `url` themselves and make a mess of the link.
- **Dismissing the sheet (`AbortError`) is a deliberate "no thanks," not a failure.** It's swallowed silently and never falls back to clipboard — falling back would hand the visitor a copy of something they just declined to send.

Wizda's `copied`/`failed` lines are deliberately state-neutral (never "link copied" or "query copied") because the same flow runs from three different URLs: the Oracle's (carries the calculator's picks, below), a list's (carries a `?q=` search), and the junk detail modal's (carries `&junk=`).

## The Oracle's shareable query

Calculating a result is worth a link on its own — `oracleUrlState.ts` serializes the calculator's picks to `URLSearchParams` and `useOracleUrlState.ts` is what writes them to `window.history`.

### Vocabulary

Param keys match `GuaranteeFilters`' own field names — `equipment`, `category`, `rank`, `quality`, `grade`, `blessings` — so the URL, the API and the docs all speak one vocabulary. Values are lowercased with underscores turned to hyphens (`TWO_HANDED_AXE` → `two-handed-axe`) purely cosmetically, for whoever it gets pasted in front of; equipment names ride through unslugified since they're arbitrary display strings, not codes. Multi-value axes repeat the key (`&blessings=atk&blessings=sur`) rather than comma-joining, since `URLSearchParams.toString()` would percent-encode a literal comma into something uglier than repetition.

**Certainty never rides the URL.** It's parsed when present (a hand-edited or replayed link) but never written by `filtersToParams`, and never counted by `filtersFromParams`'s "is this a shared query at all" check. A shared link hands the recipient a *query*, not the sharer's confidence level in it — the recipient's own certainty setting is what should apply, so callers pass their live `filters.certaintyPct` as the fallback rather than a fresh default.

**`&junk=` is a separate key, not one of the filter axes.** Opening the detail modal doesn't change what query is being asked, only whether one result is expanded on top of it — `JUNK_PARAM_KEY` is handled by its own `junkFromParams`/`buildJunkUrl` pair and must never affect `filtersFromParams`'s "is this URL a shared query" check.

### The length cap

`MAX_SHAREABLE_URL_LENGTH` (2000) is the conservative cross-platform ceiling: comfortably under the production deployment's Apache `LimitRequestLine` (8190 bytes default), and short enough that Reddit/Discord autolinkers don't truncate mid-parameter. Only an unbounded `equipment` selection can push a query past it — every other axis is small and bounded (33 categories, 6 ranks, 4 blessings, single-digit levels), but the equipment catalogue is 738 names deep with no cap on how many a player picks.

A URL over the cap is **never truncated** — silently handing the recipient a different, shorter-but-valid query is worse than not sharing at all. `buildShareableOracleUrl` falls back to a params-less URL instead, and `useOracleUrlState`'s `pushFilters` reports `fit: false` so `OraclePage` can steer the Share button toward the image export instead (dimmed, with `wizda.share.tooLarge` as the click-through explanation — see `ShareButton`'s `disabledReason`).

When a query doesn't fit, the address bar is left **untouched** — deliberately neither pushed nor replaced. Two failure modes ruled those out:

- **Pushing** a bare fallback would create a real history entry that happens to share its URL with whatever came before it. A few oversized Calculates in a row (tweak a filter, Calculate, tweak, Calculate) fill Back/Forward with indistinguishable duplicate entries — `popstate` can't tell them apart, so every in-between attempt becomes unreachable the moment it scrolls off screen.
- **Replacing** overwrites the *current* entry, which — if the last successful Calculate fit and pushed a real query URL — means turning a still-valid, still-shareable entry into a bare one. Back would then skip straight past a query that used to work.

Doing nothing keeps the address bar a faithful "last shareable state," at the cost of the on-screen oversized result not surviving a refresh — it was never encodable to begin with.

### History semantics

`useOracleUrlState` inverts the list views' `useSearchQueryParam` on purpose: that hook uses `replaceState` throughout because a search box changes continuously (mid-keystroke). The Oracle's picks change in discrete, deliberate steps — Calculate, opening a detail row — each worth its own history entry:

| Action | Write | Why |
|---|---|---|
| Calculate (`pushFilters`) | `pushState` (skipped if it doesn't fit) | a deliberate, nameable new query |
| "Back to start" (`pushCleared`) | `pushState` | the empty state is a destination, not a dismissable overlay — Back off a result should land there, not replay the previous query |
| Open detail modal (`pushJunk`) | `pushState`, marked with `JUNK_PUSH_MARKER` | opening it is a distinct action on top of whatever query is showing |
| Close detail modal (`closeJunk`) | `history.back()` if this page pushed the entry being left, else `replaceState` | undoes exactly the one entry opening it added — what makes a phone's Back button close the modal the same way the × does. Falls back to `replaceState` when the visitor landed directly on a `junk=` link, since Back there would leave the site entirely |

All native `window.history` calls, never `router.push`/`router.replace` — App Router has no shallow routing, so either would re-run the route's render on every call. A native `popstate` listener (not a `useSearchParams()` effect) handles Back/Forward, and only ever fires on the user's own navigation, never on this page's own `pushState` calls — so there's no write-triggers-read-triggers-write loop to guard against.

`OraclePage.applyUrlState` is the single code path for both "landed on a shared link" (the mount effect) and "navigated here via Back/Forward" (the `popstate` callback) — deliberately the same function, so the two ways of arriving at a URL can't drift into different behaviour. It uses `filtersEqual` to tell "only `&junk=` toggled" (skip straight to resolving the modal against the already-displayed `result`) apart from an actual new query (refetch). The two callers differ in one thing only, the certainty they seed it with, and that difference is load-bearing — see "Landing on a shared link" below.

## Landing on a shared link

The receiving half. `OraclePage`'s mount effect runs `applyUrlState(initialParams, readStoredCertaintyPct())` — the same function `popstate` uses (above) — and everything below is a consequence of *when* that runs relative to everything else the page is waiting on. All three are ordering problems, and none of them are visible from reading the encoder.

### Certainty comes from storage, not from state

The mount effect reads `readStoredCertaintyPct()` — a direct, synchronous `localStorage` read — rather than `filters.certaintyPct`, and that is not interchangeable. `useLocalStorage` is configured `getInitialValueInEffect: true`, so the remembered selection hydrates in an effect; the mount effect captures `filters` as it stood on the *first* render, which is `DEFAULT_FILTERS`, and no later hydration will ever land in that closure.

Trusting it there does double damage: every shared link replays at the default certainty, **and** the subsequent `setFilters(parsed)` writes that default straight back over the player's remembered one. A player who had settled on 99% opens a friend's link once and quietly loses the setting.

`readStoredCertaintyPct` falls back to the default on everything unreadable — no `window` (the module is imported during prerender), storage that throws (privacy-locked browsers), unparseable JSON, a value out of range. The `popstate` callback is the opposite case and correctly reads `filters.certaintyPct`: it's kept fresh on every render via a ref, so by the time a Back can happen the stored selection has long since hydrated into it.

### `&junk=` past the first page

Results page 50 at a time (`DEFAULT_GUARANTEE_LIMIT`), so a shared `&junk=` naming a junk ranked below that isn't in the fetched result at all. `openJunkByName` falls back to a single-point `certaintyCurve` request at the current certainty, which stands in for the row `junkToGuarantee` would have produced — and doubles as the existence check, since it 404s `UNKNOWN_JUNK` on a name no junk has.

An unresolvable deep link (a typo, a junk a later scrape dropped) closes the modal **silently**. It's no different from the 404 the API would give it, and the plan is the same as `UNKNOWN_EQUIPMENT` elsewhere: leave the ranking showing rather than block on it.

Nothing here consults the junk catalogue first, deliberately — on a cold load of a shared link `DetailProvider`'s fetch is still in flight (it starts from an effect on the same mount), so gating on it would turn every such link into a silent no-op. The one field the catalogue owns, `hasMultiplePools`, is resolved at *render* instead (`openEntryResolved`), so the caveat appears as soon as the lists land whichever way the race goes.

### The scrim

`PreparingVeil` covers the form while this is happening, and the shared-link case is half its reason for existing: without a cover, someone opening a link watches an empty-looking form paint and then rewrite itself, which reads as a broken page rather than a loading one. Two waits under one treatment — the state above arriving, and (only if the URL turned out to name equipment) the gear catalogue that turns those stored English keys into the localized names the sharer actually picked.

It's latched via `preparedRef`, not plainly derived, because a language switch re-pulls the lists with the form long since filled in — re-deriving would drop a scrim over a page that isn't waiting for anything the player can see.

## The junk detail share menu

The detail modal (`JunkDetailModal.tsx`) is the one place in the app offering *two* things worth sharing, via `ShareMenu`: the link (the exact same `useShareUrl` flow as above, since `&junk=` is already live on the URL by the time the menu is visible) or a picture, built by `shareCard.ts` from `JunkShareCard.tsx`. Nowhere else needs the choice — every other shareable page has just the one thing worth sharing (the page itself, or a list search) and keeps the plain single-action `ShareButton`.

### Why an image at all

A junk query can be too specific for a URL alone to carry the moment — or, per the length cap above, literally too large to encode — and a picture is the natural shape for a Reddit post or a Discord drop, where a link often doesn't even unfurl. `JunkShareCard` is not a screenshot of the modal; it reuses the modal's own components (`QuerySummary`, `CertaintyCurve`) at the modal's own proportions, but differs in three deliberate ways:

- The header band carries the site's name instead of "Junk details" — a picture pasted into Discord has to say where it came from.
- The footer carries the tool's URL where the modal has its "see full details" button, since a static image can't be clicked.
- The junk-needed count gets a headline of its own, roughly double the modal's own emphasis — on screen the crimson curve row is enough because the reader arrived by asking the question, but in a feed the number *is* the post.

It's mounted off-screen for as long as the modal is open (`SHARE_CARD_OFFSCREEN_STYLE`, `position: fixed; left: -10000px`) rather than spun up on click, so there's no layout frame to wait for and no risk of capturing it half-laid-out. `display: none`/`visibility: hidden` are avoided for the same reason in reverse: both propagate into the rasterizer's cloned computed styles and produce an empty image.

### Rasterizing real DOM

`renderJunkDetailCard` uses `html-to-image`, which clones the node with computed styles inlined into an `<svg><foreignObject>` and draws that to a canvas — there is no native browser API for "turn this DOM subtree into pixels." This used to be a hand-drawn `<canvas>`; the switch to real DOM is what stops the card silently drifting from the on-screen theme every time a colour or size changes there, since it's the theme's own components doing the rendering rather than a second implementation of them.

Two consequences of how `html-to-image` works, worth not rediscovering:

- **Nothing is fetched during rasterization.** Fonts must be inlined as `data:` URIs up front (`getFontEmbedCss`, resolved once per session and reused). The card gets away with never doing this for images because every icon on it is an inline SVG component (Tabler / game-icons), never an `<img>` — keep it that way.
- **The capture runs twice, keeping the second result.** WebKit's first `foreignObject` rasterization of a subtree routinely lands before the embedded `@font-face` rules are applied, yielding fallback type or missing text. The second pass reuses the cached font CSS and the now-warm layout, so it costs little against a flow already gated behind a deliberate click with a toast at the end.

### Delivery order

`deliverJunkDetailImage` hands the rendered blob to whichever the device can actually do, in order:

1. **The OS share sheet**, gated on the same `prefersShareSheet()` device check as the link flow, *and* `navigator.canShare({ files: [file] })` — Web Share Level 2 (file sharing) isn't universal even where `navigator.share` itself is. Its own UI is the feedback, so this reports `'share'` and the caller stays quiet. Dismissing it (`AbortError`) is reported as `'share'` too rather than falling through to clipboard/download — same reasoning as the link flow's own `AbortError` handling.
2. **The clipboard**, everywhere else — both Discord and Reddit accept a pasted image directly.
3. **A plain download**, if even the clipboard write is unavailable or denied.

`ShareMenu`'s caller (`JunkDetailModal.handleShareImage`) turns the *reported* method into the right toast: silence for `'share'` (the sheet already gave feedback), `wizda.share.imageCopied` for `'clipboard'`, `wizda.share.imageSaved` for `'download'`, and `wizda.share.imageFailed` if rasterization or delivery throws outright.

## Known limits

- **An oversized Oracle query has no shareable link at all** — only the dimmed Share button's explanation and, from the detail modal, the image export. There is no truncation fallback, and none is planned (see the length-cap section above for why).
- **The share-card footer never carries the live query string** — only the host and `/junk-oracle`. A filter naming dozens of equipment would make an unreadable watermark; the link is the *other* share item, for exactly that case.
- **A shared link carries the sharer's locale, not the recipient's.** `/ja/junk-oracle?…` shows Japanese to an English speaker, because a prefixed URL is never redirected — that rule is [`docs/i18n.md`](./i18n.md)'s, and it is the right trade (a cookie that could override the path would make every shared link lie about its contents). The share-card image is the exception: its footer is deliberately language-less (`wizda.app/junk-oracle`), so it lands on the middleware's own cookie/`Accept-Language` resolution and each viewer gets their own language.
