# Wizda's voice

Wizda is the app's mascot and narrator — a fairy guide who does the tedious inventory-reversing math so the player doesn't have to. Everything she "says" to the player lives in one place: the phrase catalog at [`packages/web-client/src/mascot/voice.en.ts`](../packages/web-client/src/mascot/voice.en.ts), typed by the `WizdaLines` contract in [`voice.ts`](../packages/web-client/src/mascot/voice.ts). This document describes the character so her lines stay true to her.

## Who she is

Warm, quick, and a touch cheeky. She's on the player's side and a little proud of being the one with the numbers. She encourages, she teases when you ask for the impossible, and she never pretends the RNG is tamer than it is. If she gets something wrong (There's an error), she gets a little flustered, but tries to help the player without apologizing ("Wait! Don't look! I couldn't load the gear list — refresh and I'll try again.").

## How she talks

- **First person, second person.** She's "I"; the player is "you". She *counts the junk for you*, *ranks the junk*, keeps things *in her notes*.
- **Short. One idea per line.** Multi-part explanations are joined with `TsUtilities.stringJoin` (prose joined with spaces), not crammed into one breath. The info modals carry the detail; her toasts stay light.
- **Wizardry-lore-aware, lightly.** She reaches for the game's texture without leaning on it: *delving*, *the abyss*, *adventurer*, **GREAT Agora** (popular patron among the playerbase), *junk*, and grades as **colours** ("may your grades be red"). Grade order is White → Green → Blue → Purple → Red.
- **Honest about odds.** The whole app exists because a drop is never truly guaranteed. She says so plainly ("not even GREAT Agora can guarantee you'll get it") rather than overselling.
- **Helpful on failure.** When something can't work she names *why* and, when she can, offers the fix: "try reselecting it", "try loosening the filters", "Ask for fewer blessings, or grind something else."

## Do / don't

- **Do** keep it to a sentence or two; let the ⓘ info modals do the teaching.
- **Do** use the game's own words for its concepts (junk, blessings, grade colours, quality stars, ranks/materials).
- **Do** put every new player-facing line in the catalog, not inline — so it can be kept in-voice and, later, translated. The `voice.test.ts` guard fails on a blank or missing entry.
- **Don't** promise certainty, and don't bury the one modelling assumption behind blessing odds — she flags it (`oracle.estimateNote`).

## Where her lines surface

She's spread thin across the whole app rather than parked on one screen: a greeting on arrival (toast, or a banner on small screens), the Oracle's subtitle and nav tooltip, the ⓘ help on every filter, the results panel's empty / no-match / end-of-list states, the cleanup confirm, error toasts, the maintenance gate, the data-freshness note, and a hello on About. The catalog's top-level groups — `greet`, `oracle`, `errors`, `away`, `about`, `credits`, `data`, `confirm` — name the surfaces; grep a key to find the component that renders it.

Two placements you wouldn't guess: `oracle.snark` does double duty as the empty-query nudge *and* the `NO_QUERY` error, and `credits.thanks` fires on a first visit to the **Equipment list**, not on About.

## The static / dynamic split

Most entries are plain strings. The cleanup-conflict lines are **functions** — they interpolate values the app computes (blessing labels, grade names, quality labels). The seam: **the catalog owns the sentence; the caller owns the values.** `oracle.facets.ts` / `oracle.logic.ts` still compute the labels and decide which message fires, then hand the formatted pieces to `wizda.confirm.*(...)`. Keep new dynamic lines that way — the words stay here where they can be read and translated, the data logic stays with the code that knows it.

## Deliberately *not* in **her** catalog

Everything player-facing is translated — the question is only which catalog a line belongs to. If a player would hear it in Wizda's voice, it goes in `voice.<lang>.ts`; if it's the app talking — headings, button text, modal titles, aria-labels, expository prose — it goes in the sitewide `strings.<lang>.ts`.

The About page is where the seam is easiest to see. Only `about.intro`, the `.wizda-speech` hello, is hers; the body copy below it is project "we" voice woven through links, lists, and markup, so it lives in `strings.<lang>.ts`'s `about.*`. `AboutContent.tsx` pulls from both — `useWizda()` for the hello, `useStrings()` for the rest.

## Adding a language

A locale is a parallel `voice.<lang>.ts` of the same `WizdaLines` shape, and it's one step of a longer procedure — see [`docs/i18n.md`](./i18n.md)'s "Adding a language" for all of it. This document covers only how she should *sound* in the new language.
