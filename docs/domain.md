# Wizda domain model

Domain knowledge for **Wiz**ardry Variants **Da**phne, and how the game's
concepts map onto the drop-rate data this tool ingests. If you're implementing
the parser, the calculation, or the shared models, read this first.

## The game (Wizardry Variants Daphne)

A horror-themed dungeon-crawler gacha set in a medieval fantasy world. The
protagonist can "reverse" decrepit things — the remains of dead creatures, old
tools — back to their prime. Mechanically:

- **Junk** = the game's loot boxes. Players obtain them freely by playing:
  dropped from defeated monsters, found in chests. There is **no hard daily
  limit**. The MC reverses junk into gear at an abandoned church.
- A party's power comes largely from the **gear** you equip, so players farm
  junk hoping to reverse it into the *exact* gear they want. That farming math
  is tedious to redo every run — **this tool does it once.**

### Gear attributes

A piece of gear is described by several independent axes:

- **Tier** — the base strength band, tied to a material. Currently, ascending:
  `bronze` → `steel` → `ebonsteel` → `silver`. Higher tier = higher base stats.
  Every junk-dropped item belongs to exactly one tier.
- **Stats** — start and final (fully-enhanced) stats are fixed per item. 
  Not a source of randomness for our purposes.
- **Quality** — shown as **stars, ★1–★5**. Higher quality = larger stat values
  on each blessing (a ★1 blessing might give ~2 ATK; a ★5 the same blessing
  ~12).
- **Grade** — shown as a **color = number**: White = 1, Green = 2, Blue = 3,
  Purple = 4, Red = 5. Grade dictates how many blessings are **active**:
  White = 0 … Red = 4.
- **Blessings** — extra stats on the gear. Flat (e.g. `+ATK`) or percentage
  (e.g. `+ATK%`). **Max 4 blessings.** *Which* blessings appear and their
  probabilities are **not** in the drop-rate-by-junk data — see
  [Data sources](#data-sources).

So a fully-specified "gear I want" query looks like:

> *a **★4** **Red-grade** **silver** **two-handed axe** with an **ATK** and an
> **ATK%** blessing*

…which decomposes into: item identity (tier + type) + quality + grade +
blessing set. The first three come from one data source; the blessings from
another.

### Item identity vs. category/tier

In the drop data an item's identity is just its **name** (e.g. *"Bronze
Two-Handed Axe"*). That name is usually *descriptive*: it encodes both the tier
(*Bronze*) and the equipment category (*Two-Handed Axe*), so tier and category
can often be recovered by parsing the name.

But not always. Plenty of named items don't spell out their category or tier —
e.g. *Mace of Agony*, *Thieves' Boots*, *Rabbit Tail*, *Ring of the Warrior
Princess*. For those, category (and sometimes tier) cannot be derived from the
name and needs an explicit item→category association instead of string parsing.

Crucially, **the core "how much junk?" calculation does not need the category or
tier at all.** It works off the item as it appears in the drop table — the
`(junk, group, item, quality, grade)` tuple carries all the probability. Tier
and category are an *enrichment* axis: they power looser, friendlier queries
(*"any silver two-handed axe"*) and display, but the answer to *"how much junk
for **this specific item**?"* is computable even when the category is unknown.

## Data sources

Two distinct HTML tables (samples live in `sample_data_source/`):

1. **Drop Rates by Junk** — item identity + quality + grade, per junk type.
   This is the primary structure described below.
2. **Drop Rates Related to Additional Blessings** — which blessings a piece can
   roll and with what odds. Grade determines *how many* active blessings;
   quality determines their *magnitude*; this table determines *which* ones.

A complete calculation joins both. Each source's structure is detailed below.

## "Drop Rates by Junk" structure

Each **junk type** is an `<h2>` heading followed by exactly one `<table>`.
Junk types are named by context/source, e.g. *Beginning Junk*, *Beginning Light
Weapon Junk*, *Beginning Light Armor Junk*, *Trade Waterway Unusual Fairy
Junk*, *Trade Waterway Exceptional Junk*.

Each table is a **two-level nested probability tree** (groups contain items),
with per-item quality and grade distributions:

| Level | Column(s) | Meaning | Sums to |
|-------|-----------|---------|---------|
| Group | `Group Number` + `Drop Rates` (`rowspan`) | P(group) | 100% across groups |
| Item  | `Equipment` + `Drop Rates` | P(item \| group) | 100% within a group |
| Quality | `★1`…`★5` | P(quality \| item) | 100% per item |
| Grade | `1`…`5` | P(grade \| item) | 100% per item |

The `rowspan` on the group cells means a group's number + rate appear once and
span all its item rows.

### Probability of one junk yielding a target

```
P(item, quality, grade | junk) =
      P(group)
    · P(item  | group)
    · P(quality | item)
    · P(grade | item)
```

Blessing probability (from source 2) multiplies in on top of this when the
query specifies blessings.

### "Guarantee" really means a confidence threshold

For any target with P < 1 you can **never** truly guarantee a drop. The tool's
"how much junk to guarantee X" is really *"how many junk for a chosen
confidence level"*:

```
n = ceil( ln(1 − confidence) / ln(1 − P) )
```

e.g. for 99% confidence use `confidence = 0.99`. Keep the product-facing word
"guarantee" but implement it as a confidence threshold (pick a sensible default,
e.g. 99%, and consider exposing it).

The full "how much junk?" calculation — how the per-junk match probability is
assembled from a query, how junks are combined and ranked, and the blessing
extension — is written up in **`docs/calculation.md`**.

## "Drop Rates Related to Additional Blessings" structure

Source (2). A **single logical table** holds all the blessing-rate data (not
one per junk) — but the *page itself* is not single-table. It also contains
an unrelated "Alteration Stone" mechanic (rerolling an existing blessing's
magnitude): an `<h2>Example</h2>` table, plus two more `<h1>` sections
("...When Using Lesser Full Alteration Stones" / "...Full Alteration
Stones") with several tables each. 14 `<table>`s total on the real page; only
the one under `<h1>Additional Blessing Drop Rates by Equipment</h1>` matters
here. The parser locates it by header shape (`Equipment`, `Additional
Blessing Slots`, then the 19 blessing columns), not by heading text or
position, and requires exactly one match. The additional-blessing odds are a
property of the *equipment*, independent of which junk dropped it.

- **Rows** are `(equipment, slot)`: each equipment spans 4 rows via `rowspan`,
  one per **blessing slot** (`1`–`4`). Slots fill top-to-bottom on the equipment
  screen, and a piece's number of **active** slots equals its **grade**
  (White 0 … Red 4).
- **Columns** are `Equipment`, `Additional Blessing Slots`, then **19 blessing
  columns**: 9 percentage variants (`ATK Increase (%)` … `ASPD Increase (%)`)
  and 10 fixed/flat variants (`ATK Increase (fixed)` … `SUR Increase (fixed)` …
  `ASPD Increase (fixed)`).
- **Each `(equipment, slot)` row sums to 100%**, so a cell is
  `P(that blessing lands in this slot | equipment)`. `-` = 0 (impossible).

This answers *which* blessing appears in a given slot, complementing source (1)'s
*what item / quality / grade*.

### The blessing/stat set (authoritative)

The 19 columns enumerate all **10 base stats** — ATK, MAG, DIV, ACC, **EVA**,
RES, DEF, MDEF, ASPD, SUR. Every stat has both a flat and a % blessing **except
SUR** (flat-only) → **19 blessings** (`9 × 2 + 1`). This table is the source of
truth for the stat/blessing catalog, mirrored in
`packages/shared/src/domain/stats.ts` (`STATS` / `BLESSINGS`). Note EVA
(evasion) is easy to overlook — it doesn't appear in casual stat lists but is a
full flat-and-% blessing here.

### Blessings don't stack (draws are without replacement)

The header notes *"Additional Blessings applied to a single piece of equipment
do not stack."* So across a piece's active slots the blessings are drawn
**without replacement** — no piece gets the same blessing twice. A joint query
(*"an ATK **and** an ATK% blessing"*) is therefore a probability over slot
assignments with a no-repeat constraint, **not** a simple product of per-slot
odds.

Empirically, flat blessings dominate the low slots and % blessings concentrate
in the higher, harder-to-reach slots (e.g. *Bronze Dagger* slot 1 is ~92% flat,
~8% percentage), matching the in-game feel of % blessings being rare.

## Parser gotchas (verified against the sample HTML)

- **Quality and grade are separate distributions**, not the same numbers. They
  are identical in *Beginning Junk* (80 / 15 / 5) but diverge in *Exceptional*
  (quality ★2 = `88.5458%` vs grade 2 = `88.9000%`). Parse and model them
  independently — do not collapse them.
- **Quality/grade are per-item, not per-group.** Items in the same group can
  differ, e.g. *Thieves' Boots* is 100% ★1 while its groupmates are 80 / 15 / 5.
- **`-` means 0 / impossible**, not missing data.
- Rates are strings with a trailing `%` and up to 4 decimal places
  (`"88.5458%"`); parse to a number and decide on a canonical precision.
- Group cells carry a `groupSeparator` CSS class on the last row of each group;
  useful as a structural hint but the `rowspan` on the group cell is the
  authoritative grouping signal.
- The same named item (e.g. *Rabbit Tail*, *Ornate Leather Armor*) can appear
  in multiple junk types and multiple groups — item identity is not unique to a
  junk. Deduplicate items; the (junk, group, item) triple is what carries the
  rate.
- **Column order in the blessings table is not natural stat order**: the 10
  "fixed" columns list SUR before ASPD (`ATK … MDEF, SUR, ASPD`), unlike the
  "percentage" columns and unlike `STATS`' declared order. Derive each
  column's blessing code from its header text, don't assume a fixed position.
- **Equipment identity is shared** between "Drop Rates by Junk" and this
  table via `Equipment.name` (both seeds upsert by name, whichever runs
  first creates the row). Some equipment appears in the blessings table with
  no matching junk drop rows at all — not a bug, just equipment obtainable
  only via other means not yet scraped (Remains/Bonus Equipment). Treat "no 
  `EquipmentDropRate` rows for this equipment" as "no known
  junk source," not as impossible/zero, when building the guarantee calc.
- Like the junk page, the same equipment's 4-row block could in principle be
  listed twice (the junk page's `hasMultiplePools` phenomenon) — the parser
  defensively keeps the later occurrence and warns if so, but as of the
  260704 sample this has never actually been observed here, so no analogous
  `Equipment` schema flag has been added. Add one if a real scrape ever shows
  otherwise.
