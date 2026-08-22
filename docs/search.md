# Wizda search matching

How every search box in Wizda decides whether a query matches an item — the equipment multi-select, the `/junks` and `/equipment` tables, and the Oracle's results filter. For *what* the localized name columns are, see [`docs/domain.md`](./domain.md)'s "Localized names"; for the wording used in each language, see [`docs/glossary.md`](./glossary.md). This doc is about **matching behaviour and the decisions behind it**.

The implementation is `packages/web-client/src/utils/search.ts` (pure, unit-tested) plus one seed-time pass, `packages/backend-api/prisma/seed-from-html/seedJapaneseReadings.ts`.

## The shape of a match

One compiled matcher per query, tested against every candidate — the caller runs it across the whole catalogue on each keystroke, so the query is parsed once, not once per item.

A query is split on whitespace into **terms**. An item matches when **every term** is found somewhere in **any** of its candidate texts:

- Order-independent — "silver axe" and "axe silver" both find *Silver Two-Handed Axe*.
- Substring, not prefix — "dagger" finds *Frost Dagger*.
- A term may not straddle a space, so "verdrop" does **not** find *Bow of the Water Drop*.
- Different terms may match different candidate texts: one from the display name, another from its reading.
- An empty query matches everything.

Both sides go through `normalize()` first (below). Callers normalize each item **once** and reuse it, which is why the matcher's method is named `matchesNormalized` — passing raw text fails silently by matching less, so the precondition is in the name rather than a comment.

## Normalization

```
NFKC  →  lowercase  →  strip IGNORED_PUNCTUATION  →  toHiragana(_, { passRomaji: true })
     →  collapseLongVowels
```

**Punctuation** is dropped so a typed term never has to reproduce a name's punctuation: "twohanded" finds *Two-Handed Axe*, "goddesss" finds *Goddess's Earrings*. Spaces survive, which is what stops a term straddling two words. The set carries one Japanese mark, `・` (nakaguro), which separates the parts of a transliterated name (`ル・ビッケン`) that a player types as one run.

**NFKC** is defensive, not corrective. The scraped names contain zero full-width ASCII and zero half-width katakana today; it costs one call and guards pasted input and future scrapes.

**`passRomaji: true` is load-bearing.** Without it wanakana transliterates the Latin alphabet too, and `Silver Two-Handed Axe` becomes `しlゔぇr とぉーはんでd あぇ`. With it, kana fold and ASCII passes through — decided *per character*, which is what lets one normalizer serve both languages. It is also strictly better than testing the whole string with `isRomaji`: `Lv2 剣` is neither wholly romaji nor wholly Japanese, so a string-level predicate has no useful answer for it.

**Long vowels are collapsed**, because one sound has several legitimate spellings and the name and the query rarely pick the same one:

| Spelling | Where it comes from |
|---|---|
| `フード` | katakana holds the vowel with `ー` |
| `ふうど` | hiragana repeats the vowel — likewise `おう`, `えい` |
| `fudo` / `fuudo` / `fu-do` / `fūdo` | romaji, with macrons unavailable on most keyboards |

Rather than enumerate the pairings, both sides drop the length and all of the above become `ふど`. `collapseLongVowels` removes `ー`, and removes a vowel-kana that continues the preceding kana's vowel. Small kana carry their own vowel, so `とうきょう` → `ときょ`: `きょ` is one mora over two characters and survives intact, and only the `う` lengthening it is dropped.

This is also why `ー` is *not* in the punctuation set — it spells a vowel rather than punctuating. wanakana expands it for us when converting katakana (`ライオンハート` → `らいおんはあと`) but leaves it alone in hiragana, so the collapse handles both.

It over-collapses on purpose: `くうき` (air) and `くき` (stem) both become `くき`. Because it runs on the query *and* the candidate, that can only ever merge two spellings into one match, never split one apart — an occasional extra row in a filter list, against a name the player otherwise cannot find at all.

## Term aliases

A term may also match any of its aliases, so an alias only ever *widens* a search. Keyed by the whole normalized term, never a substring — `1h` expands, `1hp` doesn't.

The table is deliberately small. Each entry is an abbreviation players actually type (`2h`), a spelling variant (`armour`), a name the game itself shortens (*Heavy Helm* is a helmet), or a name players reach for instead of the printed one (`lana` → *Blade Cuisinart*, after the adventurer). Aliasing is one-directional: `onehanded` does not find an item literally named *1h*.

## Japanese

Japanese breaks substring matching in a way English never exposed, because one name is written in three scripts at once — `火の魔窟の緋色の中防具のガラクタ` is kanji, hiragana and katakana in a single string — and the script a player *types* is not the one the name is *written* in.

Two of the three gaps are transliteration, and normalization closes them. The third is not.

| Player types | Name is | Closed by |
|---|---|---|
| `らいおん` | `ライオンハートシールド` | kana folding in `normalize()` |
| `raion` | `ライオンハートシールド` | romaji→kana alias on the term |
| `よる` | `夜` | **a stored reading — nothing else can** |

### Hiragana is the target, not romaji

Romaji is not a normal form. `juu` and `jyuu` are the same word, so canonicalizing *to* romaji forces you to pick one spelling and lose whoever typed the other. Converting *into* kana is many-to-one and converges:

```
juu  → じゅう
jyuu → じゅう
```

Same for `shinbun`/`shimbun`, `toukyou`/`tokyo`. Hiragana also costs nothing in practice: the per-keystroke work is identical, and the byte difference is a few KB across a whole list.

### wanakana, not hepburn

Players type **wāpuro rōmaji** — the IME convention (`toukyou`, `jyuu`, `nn`), which avoids macrons because they're hard to type. The `hepburn` package implements *strict Hepburn* (`tōkyō`), a romanization standard for print, not a model of keyboard input. wanakana is built for wāpuro, which is why it handles `jyuu` → `じゅう` and passes `tōkyō` through unconverted.

(The sister project conjapo uses `hepburn`, but its needs are different — it converts romaji input against a JMdict-supplied kana column, and never has to model what a player's fingers do in a filter box.)

### Romaji aliases are additive, with a length floor

The romaji→kana form is added *alongside* the typed term, never instead of it. That matters because ~229 equipment have no Japanese name yet and display English even with the UI in Japanese — a player must still find those by typing English.

It also makes the feature self-gating: in English every candidate is ASCII, so a kana needle can never match and behaviour is byte-identical to before Japanese existed. No language flag is threaded through the search path.

Terms shorter than 3 characters are not converted. `no` → `の` appears in nearly every Japanese item name and would match the entire catalogue.

### The reading column

`Equipment`/`Junk.nameJaReading` stores the hiragana **reading** (yomi) of `nameJa`, computed at seed time by kuroshiro over kuromoji's IPADIC. Reading kanji needs a dictionary, not a rule — so we run one once, offline, and store the answer.

This is the standard shape of the problem, not a Wizda invention: Elasticsearch's Japanese stack indexes a `kuromoji_readingform` field beside the text, and Japanese web forms have carried a separate フリガナ field for decades.

The client matches the display name **and** the reading, which is why **a wrong reading is a miss, never a wrong hit** — kanji queries hit the name directly whatever the reading says. If the game reads `翠色` as `みどりいろ` and we stored `すいしょく`, typing the kanji still works.

Schema details, the seed-only dependency boundary, the override table, and the per-language scope are in [`docs/domain.md`](./domain.md)'s "Japanese readings".

### Why the reading is stored un-normalized

The DB holds a *reading* — a linguistic fact. Casing, punctuation and katakana folding are *search policy*, and they live in `normalize()` on the client.

Baking the policy into the column would mean the stored keys and the live query were normalized at different moments, so a rule change degrades matching silently until a reseed — and this is a heuristic we expect to keep tuning (the long-vowel gap below is the obvious next tweak). Measured cost of keeping it client-side: **8.85 ms once per data load** for ~1,200 names, against a 0.064 ms per-keystroke filter. It also keeps `packages/shared` free of runtime dependencies.

## Performance

Item text never changes between keystrokes; only the query does. So each candidate is folded **once**, cached against the `data` array's identity, and the per-keystroke cost is just `includes` over pre-folded strings:

| | |
|---|---|
| Fold ~1,200 names | 8.85 ms, once per data load |
| Filter, per keystroke | 0.064 ms |

This is *cheaper* than the pre-Japanese code, which re-lowercased the whole catalogue on every character.

The projection functions (`searchTexts` / `getSearchTexts`) must be stable — `useCallback` — or the cache is thrown away each render. Only the equipment select and the two list tables are large enough for this to matter; the category and rank selects are a few dozen items and don't bother.

## Debounce and IME

These are one feature, not two. While a Japanese IME is composing, `onChange` fires for every uncommitted keystroke — typing `らいおん` emits a handful of intermediate states before the word exists. A plain debounce filters against those fragments, so results thrash mid-word. Gating on composition and debouncing each fix half of it.

`src/hooks/useDebouncedSearch.ts` does both: the field echoes every keystroke (so typing never feels laggy), while the *filtered* value waits ~300 ms and ignores anything typed mid-composition. `compositionend` flushes the committed text directly off the element, because picking a candidate with the mouse ends composition without another change event.

**Mantine already guards its own keyboard handling** — `use-combobox-target-props` returns early on `isComposing` for arrows and on `keyCode === 229` for Enter, so the IME confirm key is not swallowed by the combobox. What it can't know about is our Backspace-removes-pill handler, which runs *before* Mantine's and needs its own `isComposing` check.

## Shareable search URLs

The junk and equipment lists mirror their search box into the URL as `?q=<query>`, so `/en/junks?q=fordraig` is a real, copy-and-shareable link that lands pre-filtered. The same `Url` template backs `opensearch.xml`, which is what lets a browser's address bar search the junk list directly (type the domain, hit Tab, type a query). `src/hooks/useSearchQueryParam.ts` owns the contract; `DataTable`'s `initialQuery`/`onQueryChange` props are the wiring into it.

Two decisions worth not re-litigating:

- **`window.history.replaceState`, not `router.replace` and not `pushState`.** App Router has no shallow routing, so `router.replace` would re-run the route's render on every debounce tick. And it's `replace`, not `push`: the 300 ms debounce fires mid-word on slow typing, so a `pushState` per settled value could leave 2–3 history entries behind one search, and the back button would step through them instead of leaving the page.
- **`/junks?q=…`, not `/junks/<slug>`.** A query param handles multi-word and Japanese queries without percent-encoding a path segment, and rides through the middleware's locale redirect for free (`search` is preserved — see `docs/i18n.md`). It also keeps `/junks/<slug>` free for a real per-junk detail route later; today the detail is a modal opened by clicking a row, and a shared search link always lands on the filtered list rather than auto-opening one.

The query is seeded once, on mount, from `useSearchParams()` — after that the input owns its value, so there's no two-way binding to keep in sync with a URL that can also change independently (e.g. Back).

How that URL then gets handed to someone — the share button, and the Oracle's own much larger URL-state contract — is [`docs/sharing.md`](./sharing.md).

## Known limits

- **Macrons are unsupported.** `tōkyō` passes through unconverted, because wanakana models wāpuro rōmaji (what a keyboard produces) rather than Hepburn. Low-impact in practice — a player who can type `ō` can type `ou`, and the long vowel collapse means either reaches the same place.
- **Long-vowel collapse is lossy in one direction.** A query that *starts* mid-long-vowel no longer matches: `うど` will not find `フード`, because the candidate collapses to `ふど` while a leading `う` has no preceding vowel to merge into. Typing from a mora boundary (`ふど`, `ふうど`, `ふーど`, `fudo`) all work. Deliberate trade — see the over-collapse note above.
- **A reading that disagrees with the game costs a miss.** If players call `翠色` みどりいろ and kuromoji read it すいしょく, kana search won't find it. Kanji search will. Fixing one means adding it to the seed's override table.
- **`ko`/`de` have no readings.** Hangul and German are matched by the normalizer as-is; there is no script gap to bridge.
