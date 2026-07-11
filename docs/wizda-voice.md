# Wizda's voice

Wizda is the app's mascot and narrator — a small fairy guide who does the
tedious inventory-reversing math so the player doesn't have to. Everything she
"says" to the player lives in one place: the phrase catalog at
[`packages/web-client/src/mascot/voice.en.ts`](../packages/web-client/src/mascot/voice.en.ts),
typed by the `WizdaLines` contract in
[`voice.ts`](../packages/web-client/src/mascot/voice.ts). This document describes
the character so her lines stay true to her.

## Who she is

Warm, quick, and a touch cheeky. She's on the player's side and a little proud of
being the one with the numbers. She encourages, she teases when you ask for the
impossible, and she never pretends the RNG is tamer than it is. If she gets something
wrong (There's an error), she gets a little flustered, but tries to help the player
("Wait! Don't look! I couldn't load the gear list — refresh and I'll try again.")

## How she talks

- **First person, second person.** She's "I"; the player is "you". She *counts
  the junk for you*, *ranks the junk*, keeps things *in her notes*.
- **Short. One idea per line.** Multi-part explanations are joined with
  `TsUtilities.stringJoin` (prose joined with spaces), not crammed into one
  breath. The info modals carry the detail; her toasts stay light.
- **Wizardry-lore-aware, lightly.** She reaches for the game's texture without
  leaning on it: *delving*, *the abyss*, *adventurer*, **GREAT Agora** (popular
  patron among the playerbase), *junk*, and
  grades as **colours** ("may your grades be red"). Grade order is White → Green →
  Blue → Purple → Red.
- **Honest about odds.** The whole app exists because a drop is never truly
  guaranteed. She says so plainly ("not even GREAT Agora can guarantee you'll get
  it") rather than overselling.
- **Helpful on failure.** When something can't work she names *why* and, when she
  can, offers the fix: "try reselecting it", "try loosening the filters", "Ask
  for fewer blessings, or grind something else."

## Do / don't

- **Do** keep it to a sentence or two; let the ⓘ info modals do the teaching.
- **Do** use the game's own words for its concepts (junk, blessings, grade
  colours, quality stars, ranks/materials).
- **Do** put every new player-facing line in the catalog, not inline — so it can
  be kept in-voice and, later, translated. The `voice.test.ts` guard fails on a
  blank or missing entry.
- **Don't** promise certainty, and don't bury the one modelling assumption behind
  blessing odds — she flags it (`oracle.estimateNote`).

## Where her lines surface (catalog key → screen)

| Key | Where it shows |
| --- | --- |
| `greet.welcome` / `greet.daily` | First-ever visit toast; once-a-day greeting (toast, or a banner on small screens) — `WizdaGreeter.tsx` |
| `oracle.tagline` | Junk Oracle subtitle + the nav tooltip — `OraclePage.tsx`, `Shell.tsx` |
| `oracle.snark` | "Pick a filter or two" — empty-query nudge + the `NO_QUERY` error — `OraclePage.tsx` |
| `oracle.agoraLine` | Reality check when the certainty slider hits its cap — `CertaintySlider.tsx` |
| `oracle.loadError` / `errors.*` | Failed gear-list load; API error toasts — `OraclePage.tsx` |
| `oracle.emptyPrompt` / `oracle.noResults` / `oracle.endOfList` | Results-panel empty state, no-matches, end-of-list — `OraclePage.tsx`, `ResultsPanel.tsx` |
| `oracle.estimateNote` / `oracle.estimateNoteLink` | The blessing-odds assumption modal — `ResultsPanel.tsx` |
| `oracle.blessingsHelp` / `oracle.filterHelp.*` | The ⓘ help for each filter — `BlessingsFilter.tsx`, `FilterField.tsx` |
| `confirm.*` | The reactive-cleanup confirm: buttons, and every reason a selection stopped fitting — `OraclePage.tsx`, computed in `oracle.facets.ts` |
| `about.intro` | The `.wizda-speech` hello on the About page — `AboutContent.tsx` |
| `credits.thanks` | First-visit thank-you on the Equipment list — `EquipmentListView.tsx` |

## The static / dynamic split

Most entries are plain strings. The cleanup-conflict lines are **functions** —
they interpolate values the app computes (blessing labels, grade names, quality
labels). The seam: **the catalog owns the sentence; the caller owns the values.**
`oracle.facets.ts` / `oracle.logic.ts` still compute the labels and decide which
message fires, then hand the formatted pieces to `wizda.confirm.*(...)`. Keep new
dynamic lines that way — the words stay here where they can be read and
translated, the data logic stays with the code that knows it.

## Deliberately *not* in the catalog

- **The About page body.** Beyond `about.intro`, the About copy is expository
  "we"/project voice woven through links, lists, and `<strong>`/`<em>` markup —
  not Wizda's spoken lines. It stays inline in `AboutContent.tsx`.
- A few short in-context hints (e.g. the grade-slot hint in `GradeFilter.tsx`, and
  functional modal titles like "Required blessings") remain inline for now. If a
  translation pass happens, these are the first places to look beyond the catalog.

## Adding a language

A locale is a parallel object of the same `WizdaLines` shape (e.g. a future
`voice.es.ts`), `satisfies WizdaLines` so nothing can be missed. Point the `wizda`
binding in `voice.ts` at it to switch. No i18n library is wired up yet — the
catalog is the groundwork for whenever one is.
