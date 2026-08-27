# Milestone blessings

What happens to a piece of equipment's **blessings** when it is enhanced to an enhancement milestone (+5, +10, +15, +20), and where every number behind that comes from. This is the data foundation for the planned **Enhancement Oracle**, the sister tool to the Junk Oracle: it answers *"what are the odds this blessing ends up at the value I want?"* rather than *"how much junk do I farm?"*.

Read [`docs/domain.md`](./domain.md) first for the game model — rank, quality, grade, blessings. This document assumes all of it and covers only what that one does not: the *values* blessings take, and how enhancing changes them. For what **Alteration and Refinement Stones** do to a blessing's value, see [`docs/stones.md`](./stones.md).

**Notation.** `⊛` is **convolution**: `A ⊛ B` is the distribution of `a + b`, where `a` and `b` are rolled independently from `A` and `B`. Plainly, *"roll one, roll the other, add them."* So `drop ⊛ bonus` means a drop-value roll plus an independent bonus roll. In code it is `convolve()` in `packages/shared/src/domain/enhancementMath.ts`.

**"Bonus".** One distribution, two roles. An **enhancement milestone bonus** is what enhancing to +5/+10/+15/+20 grants a slot that held a blessing at drop; a **FAS bonus** is what a Full Alteration Stone grants. They are independent draws from the *same* range — the central finding below, and the reason `fas = drop ⊛ bonus ⊛ bonus`. Unqualified, "bonus" means that shared range. The community says "bonus" too; what this document calls the milestone bonus is the Fasterthoughts guide's "Enhancement Increase" table and its "Milestone Blessing".

**Basis.** Two sources, in this order. The **official drop-rate tables** at wizardry.info supply every number here, directly or by derivation. **Ten in-game observations** made on 2026-08-22 settled the one case those tables do not describe. Both were afterwards cross-checked against the Fasterthoughts community guide — see [Corroboration](#corroboration-2026-08-22).

**Status.** The scraping, derivation, and storage are implemented — the parser reads all 12 value tables, recovers the bonus, and re-verifies it 380/380 on every seed run (`blessingValueBonuses.ts`, persisted by `blessingValueRates.seed.ts` into the DB — see `docs/domain.md`'s "Blessing values live elsewhere" for the data model). The Enhancement Oracle's **endpoint** is built on top of it — `POST /enhancement-odds` and `GET /enhancement-odds/reference`, derived in [`docs/calculation/enhancement.md`](./calculation/enhancement.md). Its UI is not built yet. One stated assumption remains, flagged in [The model](#the-model).

## The model

Equipment enhances up to **+20**. At each of the four milestones — **+5, +10, +15, +20** — the item's grade rises and **exactly one blessing slot is touched**: slot 1 at +5, slot 2 at +10, slot 3 at +15, slot 4 at +20. Each slot is therefore touched once and only once.

What happens to that slot depends on whether it already held a blessing when the equipment was obtained:

| | at the slot's milestone | resulting value |
|---|---|---|
| **slot was empty** | a blessing is drawn for the slot | one initial roll |
| **slot was occupied** | the blessing keeps its identity, its value rises | initial roll **+** one bonus |

Both rolls read off the same axis — `(value group, quality, blessing)` — and both are **uniform** over their range:

- *Which* blessing a newly filled slot draws is already in our data: `EquipmentBlessingDropRate`, keyed by `(equipment, slot, blessing)`.
- The **initial** value is the published drop-value distribution, the same one that governs a blessing appearing when junk is reversed. See [Initial value at drop](#initial-value-at-drop).
- The **bonus** is derived from the published tables. See [Enhancement increase](#enhancement-increase).

Two consequences worth carrying into the tool:

1. **A filled slot gets an initial roll and nothing more** — no bonus on top. A slot that arrived occupied ends up materially stronger, because only it collects both rolls.
2. **A blessing present at drop is boosted exactly once**, at its own milestone. Its final value is `initial + one bonus`, never four.

**The one assumption.** All ten observations were White pieces taken to +5, so the empty-slot rule is *proved for slot 1* and *assumed* for slots 2–4. The assumption is a reasonable one — the source publishes a single value table per `(group, quality, blessing)` with no slot axis at all, and the game describes the mechanic identically for all four slots — but it is an assumption, and results that lean on it should say so. It gained a good deal of support on **2026-08-25**: the stone sections of the same source gate their tables on "Initial equipment Grade `n`+1 or higher" for slot `n`, spelled out identically for all four slots (see [`docs/stones.md`](./stones.md), "When each table applies"). So the game does track *"was slot `n` occupied at drop"* per slot, symmetrically across the four — which is precisely the shape this assumption needs, even though that text describes stones rather than a plain milestone.

### Worked example

A 4★ Ebonsteel dagger with a flat ATK blessing at **+8** on slot 1, enhanced to +5. Value group `RANK_1_5`, quality 4, Flat → the bonus is uniform over `3-10`, eight possible values. Reaching **≥16** needs a bonus of ≥8, so 8, 9 or 10 → **3/8 = 37.5%**.

This is the Enhancement Oracle's pinned regression case, asserted both as a unit test and against the live API with a real Ebonsteel Dagger.

## Grade at drop is not the grade you see

Two different numbers, and the source distinguishes them: its stone conditions read "**Initial** equipment Grade `n`+1 or higher", and the footnote *"This does not apply to Grade 1 equipment that has become Grade 2 after enhancement"* exists precisely because a milestone that fills a slot **raises the displayed grade**.

- **Current grade** = `1 + blessings currently on the piece`. A White piece taken to +10 shows Grade 3.
- **Initial grade** = what it was when obtained. It decides which slots were occupied at drop, and therefore which slots collect a milestone bonus and which a Full Alteration Stone will bonus.

The pair is not recoverable from the piece alone: a blue-at-drop piece at +15 and a White-at-drop piece at +15 **both** show three filled slots. Since both prefixes fill top-to-bottom, the count is always

```
filled slots = max(initialGrade − 1, floor(enhancementLevel / 5))
```

which is also why the filled slots are always a contiguous prefix — a gap between them is impossible, and a slot cannot still be empty once its own milestone has passed. `checkBlessingSlotState` in `packages/shared/src/domain/blessingSlots.ts` is that rule in code.

## Duplicate blessings, and what the draw chain actually avoids

Additional blessings don't stack, but **a piece can still end up carrying the same blessing twice**, and it isn't rare. It takes an alteration:

- **By surprise** — a slot altered to ATK, and a later milestone independently rolls ATK into an empty slot.
- **Deliberately** — the milestones gave you 1 or more blessings that are not as desired, so you alter a weak slot into something good, accepting that it will only have the low alteration-plus-refinement value.

What that tells us is more than a UI caveat: **an Alteration Stone changes what a slot displays without feeding back into the draw.** The game keeps drawing against what each slot *originally* rolled. So the exclusion set for a milestone fill is the originals, not what the piece currently shows — which is why the Enhancement Oracle asks *which* slot was altered, and ideally what it used to be. Under the other reading a second ATK would be flatly impossible rather than merely unlikely; the difference is `P = 0` versus a real number, not a rounding correction. See [`docs/calculation/enhancement.md`](./calculation/enhancement.md).

At most one slot is ever in the altered state, since every stone granting a fresh alteration first wipes the previous one (see [`docs/stones.md`](./stones.md)).

### What the milestone actually draws against

The rule, in one line:

> **A milestone fill avoids the piece's *initial* blessings — and a standard Alteration Stone's result is not one of them.**

"Initial" means what the piece rolled naturally: the blessings it dropped with, or — after a Lesser or Full Alteration Stone — **the blessings that stone produced**, since those re-rolls replace the natural set wholesale. A standard Alteration Stone is the odd one out: it overwrites what a slot *shows* without joining the initial set, and without removing the blessing it replaced from it.

So for the altered slot, both halves matter and they point opposite ways:

| | in the exclusion set? |
|---|---|
| what the slot originally rolled | **yes** — still there, even though nothing displays it any more |
| what the Alteration Stone put there | **no** — a later milestone can roll it, giving the piece two |

That is why the Enhancement Oracle asks *which* slot was altered, and ideally *what it used to be*: the answer changes a second copy from impossible (`P = 0`) to merely unlikely. Not a rounding correction.

The Lesser/Full stones need no such handling. They re-roll every blessing on the piece, so afterwards what the piece displays *is* its initial set, and any prior alteration has been wiped — which is exactly what the calculation assumes when nothing is declared as altered.

## Where the numbers come from

### The official value tables

The `alternations.html` page we already scrape for `EquipmentBlessingDropRate` carries **14 tables**, of which we currently parse exactly one. Twelve of the other thirteen are **value** tables — the probability of a blessing landing on each possible number:

| `<h1>` section | our key | meaning |
|---|---|---|
| Additional Blessing Value Drop Rates by Equipment Rank | `drop` | the value a blessing has when the equipment is obtained from junk |
| …When Using Lesser Full Alteration Stones | `lfas` | the value after a Lesser Full Alteration Stone |
| …When Using Full Alteration Stones | `fas` | the value after a Full Alteration Stone |

Each section is split across four **value groups** given as `<h2>` headings, each one table of 5 qualities × 19 blessings = **95 rows**.

### The four value groups

The source numbers the six ranks in `EQUIPMENT_RANKS` order, so **rank 1-5 is Worn through Ebonsteel and rank 6 is Silver**. The parenthetical after "Equipment Rank 6" is not another rank — it says *which Silver equipment* that table covers. Ranks 1-5 share one table between them; Silver is split three ways:

| `<h2>` heading | our key | which equipment |
|---|---|---|
| `Equipment Rank 1-5` | `RANK_1_5` | everything Worn through Ebonsteel — all five ranks share one table |
| `Equipment Rank 6 (Librarian Rod, …)` | `SILVER_NAMED` | Silver, and one of **15 pieces named verbatim in the heading** |
| `Equipment Rank 6 (Two-Handed Sword, …, Cesti)` | `SILVER_TWO_HANDED_MELEE` | Silver, and its category is one of those six |
| `Equipment Rank 6 (Excluding weapons listed above)` | `SILVER_OTHER` | every other Silver piece |

So the axis is **not** rank, and rank is only half of what picks a group: every piece below Silver shares one table regardless of what it is, while two Silver pieces can land in different groups depending on which they are. Assign in the order above, checking the named list before the 2H-melee rule.

Membership is **published in the heading text**, so scrape it rather than hardcoding it — a new banner piece joins `SILVER_NAMED` whenever the devs add one.

`SILVER_TWO_HANDED_MELEE` excludes Two-Handed Staff and Bow. Both are two-handed, but they sit with the 1H gear.

The 15 named pieces, verbatim from the heading: Librarian Rod, Citrus-Blossom Hairpin, Red Spinner Scissor Staff, Winterthorn Bell Bow, Glasses of Calm, Winterthorn Wreath, Floral Uchikake, Robe of the Millenium, Heavy Armor of Bloodrage, Red Spinner Woman Spellwoven Cloth, High Boots of the Winter Night, Dreamblossom Ornament, Ring of Torment Purging, Master Ring, Dream-Cutting Scissors. All are Silver rank. Fourteen carry `Compendium Number = "Ex."` in the Fasterthoughts CSVs, but Master Ring does not (compendium 3203), so **"Ex." is not a usable proxy** — use the published list. **Their numbers are identical to the `RANK_1_5` table**, all 95 cells in all three sections: being Silver buys these pieces nothing at all on blessing values.

### Deriving the bonus

The official page publishes no "enhancement increase" table. It does not need to — the bonus falls out of the three it does publish.

Every `drop` distribution is exactly uniform over its range (380/380 rows). The `lfas` and `fas` distributions are not; they taper at the edges. That taper is not weighting, it is the signature of a **sum of independent uniforms**. `RANK_1_5`, quality 3, flat ATK:

| table | support | shape |
|---|---|---|
| `drop` | 5–7 | `1,1,1` ÷ 3 — flat |
| `lfas` | 7–15 | `1,2,3,3,3,3,3,2,1` ÷ 21 — trapezoid |
| `fas` | 9–23 | `1,3,6,9,12,15,18,19,18,15,12,9,6,3,1` ÷ 147 — bell |

Those are exactly `U{5,6,7} ⊛ U{2..8}` and `U{5,6,7} ⊛ U{2..8} ⊛ U{2..8}`. So:

```
lfas    =  drop ⊛ bonus
fas     =  drop ⊛ bonus ⊛ bonus
bonus   =  Uniform[ lfas.min − drop.min , lfas.max − drop.max ]
```

The bonus is recovered from the supports alone, then **proved** by reconvolving it and checking it reproduces both published tables cell for cell:

| check | result |
|---|---|
| every `drop` value distribution is uniform | **380/380** |
| `drop ⊛ bonus` reproduces `lfas` | **380/380** |
| `drop ⊛ bonus ⊛ bonus` reproduces `fas` | **380/380** |

Two independent confirmations, zero failures, across all four value groups. The seed pass keeps this check on every run and fails closed per-row (a bonus that doesn't reconvolve cleanly stores anyway, flagged `isVerified: false`, rather than being dropped or aborting the seed), the way `alignLocalizedNames.ts` does.

**What this proves and what it does not.** It proves the distribution of *the term a Full Alteration Stone adds*, and that the full stone adds it twice where the lesser adds it once. Identifying that term with *the enhancement milestone bonus* rests on the game's own statement that a FAS re-applies milestone bonuses, plus the agreement noted under [Corroboration](#corroboration-2026-08-22). Strong, but an identification rather than a proof.

### Settling the empty-slot case in game

The official tables describe values at drop and after alteration stones. They say nothing about the value a milestone gives a slot that was **empty**. Three models were possible:

| hypothesis | claim | distribution |
|---|---|---|
| **H-initial** | the slot rolls as if the blessing had been there from the start | `Uniform(initial range)` |
| **H-bonus** | the slot is boosted from zero — the same path as an occupied slot | `Uniform(bonus range)` |
| **H-sum** | the slot is filled *and* boosted in one step | `initial ⊛ bonus` |

Their supports differ, so a value outside a model's range kills it permanently. Ten White 3★ `SILVER_OTHER` pieces were enhanced to +5 on **2026-08-22** (logged in the [appendix](#observations-log)). The result: **H-sum eliminated twice, H-bonus eliminated four times, and all ten values inside H-initial's ranges.**

The redundancy is what makes it safe — no single misrecorded roll changes the outcome — and the fact that no value fell outside H-initial is the positive check: a wrong-but-overlapping model would most likely have thrown one out of range across ten draws.

## The value tables

Both tables below are uniform over the range shown. The `drop` section of the official page also gives the per-value probabilities directly, so the tool never has to assume the shape.

### Initial value at drop

Used for a blessing present when the equipment was obtained, **and** for a slot filled at its milestone. Straight from `<h1>Additional Blessing Value Drop Rates by Equipment Rank</h1>`.

#### Worn–Ebonsteel (rank 1-5)

Source: `<h2>Equipment Rank 1-5</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 2-3 | 3-5 | 5-7 | 8-10 | 11-13 |
| Percent (%) | 1-3 | 3-6 | 5-9 | 9-13 | 12-16 |
| ASPD | 1-2 | 2-4 | 4-6 | 6-8 | 8-10 |
| ASPD% | 1-2 | 2-4 | 4-6 | 6-9 | 9-11 |
| SUR | 1-2 | 2-3 | 3-4 | 4-5 | 5-6 |

#### Silver — named pieces

Source: `<h2>Equipment Rank 6 (Librarian Rod, … Dream-Cutting Scissors)</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 2-3 | 3-5 | 5-7 | 8-10 | 11-13 |
| Percent (%) | 1-3 | 3-6 | 5-9 | 9-13 | 12-16 |
| ASPD | 1-2 | 2-4 | 4-6 | 6-8 | 8-10 |
| ASPD% | 1-2 | 2-4 | 4-6 | 6-9 | 9-11 |
| SUR | 1-2 | 2-3 | 3-4 | 4-5 | 5-6 |

#### Silver — 2H melee

Source: `<h2>Equipment Rank 6 (Two-Handed Sword, Two-Handed Spear, Two-Handed Axe, Two-Handed Blunt Weapon, Odachi, Cesti)</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 2-4 | 3-7 | 5-9 | 8-13 | 11-17 |
| Percent (%) | 1-4 | 3-8 | 5-12 | 9-17 | 12-21 |
| ASPD | 1-2 | 2-5 | 4-8 | 6-11 | 8-13 |
| ASPD% | 1-2 | 2-5 | 4-8 | 6-12 | 9-14 |
| SUR | 1-2 | 2-4 | 3-5 | 4-7 | 5-8 |

#### Silver — everything else

Source: `<h2>Equipment Rank 6 (Excluding weapons listed above)</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 2-4 | 3-6 | 5-8 | 8-12 | 11-16 |
| Percent (%) | 1-4 | 3-7 | 5-11 | 9-16 | 12-19 |
| ASPD | 1-2 | 2-5 | 4-7 | 6-10 | 8-12 |
| ASPD% | 1-2 | 2-5 | 4-7 | 6-11 | 9-13 |
| SUR | 1-2 | 2-4 | 3-5 | 4-6 | 5-7 |

### Enhancement increase

The **milestone bonus**: the boost applied to a slot that already held a blessing. Not published; derived per group as `lfas − drop` on the supports and proved by reconvolution, from `<h1>…by Equipment Rank</h1>` and `<h1>…When Using Lesser Full Alteration Stones</h1>`. The heading keeps the guide's name for the table ("Enhancement Increase" is its tab); `bonus` is the name of the quantity.

#### Worn–Ebonsteel (rank 1-5)

Source: `<h2>Equipment Rank 1-5</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 1-2 | 2-5 | 2-8 | 3-10 | 3-12 |
| Percent (%) | 1 | 1-2 | 2-3 | 3 | 3-4 |
| ASPD | 1-2 | 1-2 | 1-3 | 1-4 | 1-5 |
| ASPD% | 1 | 1-2 | 2-3 | 3 | 3-4 |
| SUR | 1 | 1-2 | 1-2 | 1-3 | 1-4 |

#### Silver — named pieces

Source: `<h2>Equipment Rank 6 (Librarian Rod, … Dream-Cutting Scissors)</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 1-2 | 2-5 | 2-8 | 3-10 | 3-12 |
| Percent (%) | 1 | 1-2 | 2-3 | 3 | 3-4 |
| ASPD | 1-2 | 1-2 | 1-3 | 1-4 | 1-5 |
| ASPD% | 1 | 1-2 | 2-3 | 3 | 3-4 |
| SUR | 1 | 1-2 | 1-2 | 1-3 | 1-4 |

#### Silver — 2H melee

Source: `<h2>Equipment Rank 6 (Two-Handed Sword, Two-Handed Spear, Two-Handed Axe, Two-Handed Blunt Weapon, Odachi, Cesti)</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 1-2 | 2-7 | 2-11 | 3-13 | 3-15 |
| Percent (%) | 1 | 1-2 | 2-4 | 3-4 | 3-5 |
| ASPD | 1-2 | 1-2 | 1-4 | 1-5 | 1-7 |
| ASPD% | 1 | 1-2 | 2-4 | 3-4 | 3-5 |
| SUR | 1 | 1-2 | 1-2 | 1-4 | 1-5 |

#### Silver — everything else

Source: `<h2>Equipment Rank 6 (Excluding weapons listed above)</h2>`

| Blessing type | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Flat | 1-2 | 2-6 | 2-10 | 3-12 | 3-14 |
| Percent (%) | 1 | 1-2 | 2-4 | 3-4 | 3-5 |
| ASPD | 1-2 | 1-2 | 1-4 | 1-5 | 1-6 |
| ASPD% | 1 | 1-2 | 2-4 | 3-4 | 3-5 |
| SUR | 1 | 1-2 | 1-2 | 1-4 | 1-5 |

## How this interacts with Alteration

Not needed to compute a milestone roll, but it is what players actually ask about. **This section is sourced from the Fasterthoughts guide, not the official tables.**

- Altering **before** that slot's checkpoint: the Alteration Stone's value replaces the blessing, and the later milestone still adds its bonus as normal.
- Altering **after** that slot's checkpoint: the stone's value replaces the initial blessing, any refinement, **and the enhancement increase** — and the slot is never enhanced again.

Alteration Stone values are much weaker than drop values (guide: 3★ flat `3-5`, against `5-8` initial on Silver), which is why altering a slot that already held something feels like a downgrade. For a 3★ `SILVER_OTHER` flat blessing in slot 3:

| how slot 3 ends up | value | mean |
|---|---|---|
| present at drop, enhanced at +15 | `5-8` + `2-10` = **7-18** | 12.5 |
| altered **before** +15, then enhanced | `3-5` + `2-10` = **5-15** | 10.0 |
| empty at drop, filled by the +15 milestone | **5-8** | 6.5 |
| altered **after** +15 | **3-5** | 4.0 |

So **grade at drop is worth more than it looks**, and **a milestone-filled slot cannot be pre-altered** — there is no blessing to alter until the milestone creates one, and altering it afterwards lands in the worst row. A Purple piece is not merely three-quarters of a Red; it is the last grade at which slot 3 can still be steered before its checkpoint.

## Corroboration (2026-08-22)

Everything above was cross-checked against the [Fasterthoughts guide's](https://wizardry.fasterthoughts.io/equipment/blacksmithing/) hand-written "Blessing Range Tables". It is a cross-check, not a source: no number in this document comes from it, except the Alteration rules noted above.

- **150/150 cells agree** — both its *Initial Value (Base) Stats* and *Enhancement Increase* tabs, all three of its groups, all five qualities, all five blessing-type rows. Including the Silver upper bounds: official and guide both give Silver 5★ flat `3-14` and Silver-2H `3-15`.
- **Its 5-row collapse is valid.** It groups the 19 blessings into `Flat`, `Percent (%)`, `ASPD`, `ASPD%`, `SUR`; in the official data all 8 non-ASPD flat blessings do share one range, and all 8 non-ASPD percentage blessings share another, in every group and quality. We derive per blessing anyway, so we would notice if that stopped holding.
- **It has three groups where the official page has four**, and no counterpart to `SILVER_NAMED`. Those 15 pieces roll on the rank-1-5 numbers, so its Silver table overstates them.
- **It is silent on the empty-slot case**, which is why that needed testing rather than reading.
- There is **no "double boost" for Silver** anywhere in it, despite rumors from players. Silver gets *higher* values, not two applications. The one real doubling is `fas = drop ⊛ bonus ⊛ bonus`, which holds for every group.

## Open questions

1. **Do slots 2–4 fill the same way as slot 1?** The stated assumption in [The model](#the-model). A Blue piece taken to +15 would settle it; the discriminator in the appendix applies unchanged, since the bands do not depend on the slot.

## Appendix: re-testing the empty-slot case

Kept so the answer can be re-checked cheaply after a patch, or confirmed on another slot or value group.

**Protocol.** Take a **White (grade 1, zero blessings)** piece, note its value group and quality, enhance it to **+5**, and record the equipment, the blessing that appeared, and its value. A value outside a model's range eliminates that model permanently.

### Field reference — 3★ Silver, "everything else"

The configuration the case was settled on. Check the piece first: **Silver**, **3★**, **White grade**, not one of the 15 named pieces, not a 2H melee weapon.

| blessing rolled | value | verdict |
|---|---|---|
| Flat | 2-4 | **H-bonus** — settled |
| Flat | 5-6 | narrows to H-bonus or H-initial |
| Flat | 7-8 | narrows to H-bonus or H-initial or H-sum |
| Flat | 9-10 | narrows to H-bonus or H-sum |
| Flat | 11-18 | **H-sum** — settled |
| Percent (%) | 2-4 | **H-bonus** — settled |
| Percent (%) | 5-6 | **H-initial** — settled |
| Percent (%) | 7-11 | narrows to H-initial or H-sum |
| Percent (%) | 12-15 | **H-sum** — settled |
| ASPD | 1-3 | **H-bonus** — settled |
| ASPD | 4 | narrows to H-bonus or H-initial |
| ASPD | 5-7 | narrows to H-initial or H-sum |
| ASPD | 8-11 | **H-sum** — settled |
| ASPD% | 2-3 | **H-bonus** — settled |
| ASPD% | 4 | narrows to H-bonus or H-initial |
| ASPD% | 5 | **H-initial** — settled |
| ASPD% | 6-7 | narrows to H-initial or H-sum |
| ASPD% | 8-11 | **H-sum** — settled |
| SUR | 1-2 | **H-bonus** — settled |
| SUR | 3 | **H-initial** — settled |
| SUR | 4-5 | narrows to H-initial or H-sum |
| SUR | 6-7 | **H-sum** — settled |

### Observations log

The ten rolls that settled the case. One row per enhancement; add to them if a patch ever calls the answer into question.

| date | equipment | value group | quality | blessing | value | eliminates |
|---|---|---|---|---|---|---|
| 2026-08-22 | Silver Heavy Gauntlets | `SILVER_OTHER` | 3★ | MDEF | 8 | — |
| 2026-08-22 | Silver Light Gauntlets | `SILVER_OTHER` | 3★ | DIV | 5 | H-sum |
| 2026-08-22 | Silver Light Gauntlets | `SILVER_OTHER` | 3★ | ACC% | 7 | H-bonus |
| 2026-08-22 | Silver Light Gauntlets | `SILVER_OTHER` | 3★ | DEF | 7 | — |
| 2026-08-22 | Silver Light Armor | `SILVER_OTHER` | 3★ | DEF | 8 | — |
| 2026-08-22 | Blackwing Robe | `SILVER_OTHER` | 3★ | RES | 7 | — |
| 2026-08-22 | Silver Large Shield | `SILVER_OTHER` | 3★ | DEF | 5 | H-sum |
| 2026-08-22 | Silver Shield | `SILVER_OTHER` | 3★ | DEF% | 11 | H-bonus |
| 2026-08-22 | Silver Shield | `SILVER_OTHER` | 3★ | SUR | 5 | H-bonus |
| 2026-08-22 | Blackwing Small Shield | `SILVER_OTHER` | 3★ | ASPD | 6 | H-bonus |

### Full discriminator table

Every combination, with the values that decide between the three models. `H-sum` is `initial ⊛ bonus`, so only a roll above the initial range's top can prove it. `Silver — named pieces` is omitted: every cell is identical to `Worn–Ebonsteel (rank 1-5)`.

| Value group | Blessing | Quality | H-initial | H-bonus | H-sum | decisive if you roll |
|---|---|---|---|---|---|---|
| Worn–Ebonsteel (rank 1-5) | Flat | 1★ | 2-3 | 1-2 | 3-5 | 1 ⇒ H-bonus; 4-5 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Flat | 2★ | 3-5 | 2-5 | 5-10 | 2 ⇒ H-bonus; 6-10 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Flat | 3★ | 5-7 | 2-8 | 7-15 | 2-4 ⇒ H-bonus; 9-15 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Flat | 4★ | 8-10 | 3-10 | 11-20 | 3-7 ⇒ H-bonus; 11-20 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Flat | 5★ | 11-13 | 3-12 | 14-25 | 13 ⇒ H-initial; 3-10 ⇒ H-bonus; 14-25 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Percent (%) | 1★ | 1-3 | 1 | 2-4 | 4 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Percent (%) | 2★ | 3-6 | 1-2 | 4-8 | 3 ⇒ H-initial; 1-2 ⇒ H-bonus; 7-8 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Percent (%) | 3★ | 5-9 | 2-3 | 7-12 | 5-6 ⇒ H-initial; 2-3 ⇒ H-bonus; 10-12 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Percent (%) | 4★ | 9-13 | 3 | 12-16 | 9-11 ⇒ H-initial; 3 ⇒ H-bonus; 14-16 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | Percent (%) | 5★ | 12-16 | 3-4 | 15-20 | 12-14 ⇒ H-initial; 3-4 ⇒ H-bonus; 17-20 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD | 1★ | 1-2 | 1-2 | 2-4 | 3-4 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD | 2★ | 2-4 | 1-2 | 3-6 | 1 ⇒ H-bonus; 5-6 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD | 3★ | 4-6 | 1-3 | 5-9 | 4 ⇒ H-initial; 1-3 ⇒ H-bonus; 7-9 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD | 4★ | 6-8 | 1-4 | 7-12 | 6 ⇒ H-initial; 1-4 ⇒ H-bonus; 9-12 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD | 5★ | 8-10 | 1-5 | 9-15 | 8 ⇒ H-initial; 1-5 ⇒ H-bonus; 11-15 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD% | 1★ | 1-2 | 1 | 2-3 | 3 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD% | 2★ | 2-4 | 1-2 | 3-6 | 1 ⇒ H-bonus; 5-6 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD% | 3★ | 4-6 | 2-3 | 6-9 | 4-5 ⇒ H-initial; 2-3 ⇒ H-bonus; 7-9 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD% | 4★ | 6-9 | 3 | 9-12 | 6-8 ⇒ H-initial; 3 ⇒ H-bonus; 10-12 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | ASPD% | 5★ | 9-11 | 3-4 | 12-15 | 9-11 ⇒ H-initial; 3-4 ⇒ H-bonus; 12-15 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | SUR | 1★ | 1-2 | 1 | 2-3 | 3 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | SUR | 2★ | 2-3 | 1-2 | 3-5 | 1 ⇒ H-bonus; 4-5 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | SUR | 3★ | 3-4 | 1-2 | 4-6 | 3 ⇒ H-initial; 1-2 ⇒ H-bonus; 5-6 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | SUR | 4★ | 4-5 | 1-3 | 5-8 | 4 ⇒ H-initial; 1-3 ⇒ H-bonus; 6-8 ⇒ H-sum |
| Worn–Ebonsteel (rank 1-5) | SUR | 5★ | 5-6 | 1-4 | 6-10 | 5 ⇒ H-initial; 1-4 ⇒ H-bonus; 7-10 ⇒ H-sum |
| Silver — 2H melee | Flat | 1★ | 2-4 | 1-2 | 3-6 | 1 ⇒ H-bonus; 5-6 ⇒ H-sum |
| Silver — 2H melee | Flat | 2★ | 3-7 | 2-7 | 5-14 | 2 ⇒ H-bonus; 8-14 ⇒ H-sum |
| Silver — 2H melee | Flat | 3★ | 5-9 | 2-11 | 7-20 | 2-4 ⇒ H-bonus; 12-20 ⇒ H-sum |
| Silver — 2H melee | Flat | 4★ | 8-13 | 3-13 | 11-26 | 3-7 ⇒ H-bonus; 14-26 ⇒ H-sum |
| Silver — 2H melee | Flat | 5★ | 11-17 | 3-15 | 14-32 | 3-10 ⇒ H-bonus; 18-32 ⇒ H-sum |
| Silver — 2H melee | Percent (%) | 1★ | 1-4 | 1 | 2-5 | 5 ⇒ H-sum |
| Silver — 2H melee | Percent (%) | 2★ | 3-8 | 1-2 | 4-10 | 3 ⇒ H-initial; 1-2 ⇒ H-bonus; 9-10 ⇒ H-sum |
| Silver — 2H melee | Percent (%) | 3★ | 5-12 | 2-4 | 7-16 | 5-6 ⇒ H-initial; 2-4 ⇒ H-bonus; 13-16 ⇒ H-sum |
| Silver — 2H melee | Percent (%) | 4★ | 9-17 | 3-4 | 12-21 | 9-11 ⇒ H-initial; 3-4 ⇒ H-bonus; 18-21 ⇒ H-sum |
| Silver — 2H melee | Percent (%) | 5★ | 12-21 | 3-5 | 15-26 | 12-14 ⇒ H-initial; 3-5 ⇒ H-bonus; 22-26 ⇒ H-sum |
| Silver — 2H melee | ASPD | 1★ | 1-2 | 1-2 | 2-4 | 3-4 ⇒ H-sum |
| Silver — 2H melee | ASPD | 2★ | 2-5 | 1-2 | 3-7 | 1 ⇒ H-bonus; 6-7 ⇒ H-sum |
| Silver — 2H melee | ASPD | 3★ | 4-8 | 1-4 | 5-12 | 1-3 ⇒ H-bonus; 9-12 ⇒ H-sum |
| Silver — 2H melee | ASPD | 4★ | 6-11 | 1-5 | 7-16 | 6 ⇒ H-initial; 1-5 ⇒ H-bonus; 12-16 ⇒ H-sum |
| Silver — 2H melee | ASPD | 5★ | 8-13 | 1-7 | 9-20 | 8 ⇒ H-initial; 1-7 ⇒ H-bonus; 14-20 ⇒ H-sum |
| Silver — 2H melee | ASPD% | 1★ | 1-2 | 1 | 2-3 | 3 ⇒ H-sum |
| Silver — 2H melee | ASPD% | 2★ | 2-5 | 1-2 | 3-7 | 1 ⇒ H-bonus; 6-7 ⇒ H-sum |
| Silver — 2H melee | ASPD% | 3★ | 4-8 | 2-4 | 6-12 | 5 ⇒ H-initial; 2-3 ⇒ H-bonus; 9-12 ⇒ H-sum |
| Silver — 2H melee | ASPD% | 4★ | 6-12 | 3-4 | 9-16 | 6-8 ⇒ H-initial; 3-4 ⇒ H-bonus; 13-16 ⇒ H-sum |
| Silver — 2H melee | ASPD% | 5★ | 9-14 | 3-5 | 12-19 | 9-11 ⇒ H-initial; 3-5 ⇒ H-bonus; 15-19 ⇒ H-sum |
| Silver — 2H melee | SUR | 1★ | 1-2 | 1 | 2-3 | 3 ⇒ H-sum |
| Silver — 2H melee | SUR | 2★ | 2-4 | 1-2 | 3-6 | 1 ⇒ H-bonus; 5-6 ⇒ H-sum |
| Silver — 2H melee | SUR | 3★ | 3-5 | 1-2 | 4-7 | 3 ⇒ H-initial; 1-2 ⇒ H-bonus; 6-7 ⇒ H-sum |
| Silver — 2H melee | SUR | 4★ | 4-7 | 1-4 | 5-11 | 1-3 ⇒ H-bonus; 8-11 ⇒ H-sum |
| Silver — 2H melee | SUR | 5★ | 5-8 | 1-5 | 6-13 | 1-4 ⇒ H-bonus; 9-13 ⇒ H-sum |
| Silver — everything else | Flat | 1★ | 2-4 | 1-2 | 3-6 | 1 ⇒ H-bonus; 5-6 ⇒ H-sum |
| Silver — everything else | Flat | 2★ | 3-6 | 2-6 | 5-12 | 2 ⇒ H-bonus; 7-12 ⇒ H-sum |
| Silver — everything else | Flat | 3★ | 5-8 | 2-10 | 7-18 | 2-4 ⇒ H-bonus; 11-18 ⇒ H-sum |
| Silver — everything else | Flat | 4★ | 8-12 | 3-12 | 11-24 | 3-7 ⇒ H-bonus; 13-24 ⇒ H-sum |
| Silver — everything else | Flat | 5★ | 11-16 | 3-14 | 14-30 | 3-10 ⇒ H-bonus; 17-30 ⇒ H-sum |
| Silver — everything else | Percent (%) | 1★ | 1-4 | 1 | 2-5 | 5 ⇒ H-sum |
| Silver — everything else | Percent (%) | 2★ | 3-7 | 1-2 | 4-9 | 3 ⇒ H-initial; 1-2 ⇒ H-bonus; 8-9 ⇒ H-sum |
| Silver — everything else | Percent (%) | 3★ | 5-11 | 2-4 | 7-15 | 5-6 ⇒ H-initial; 2-4 ⇒ H-bonus; 12-15 ⇒ H-sum |
| Silver — everything else | Percent (%) | 4★ | 9-16 | 3-4 | 12-20 | 9-11 ⇒ H-initial; 3-4 ⇒ H-bonus; 17-20 ⇒ H-sum |
| Silver — everything else | Percent (%) | 5★ | 12-19 | 3-5 | 15-24 | 12-14 ⇒ H-initial; 3-5 ⇒ H-bonus; 20-24 ⇒ H-sum |
| Silver — everything else | ASPD | 1★ | 1-2 | 1-2 | 2-4 | 3-4 ⇒ H-sum |
| Silver — everything else | ASPD | 2★ | 2-5 | 1-2 | 3-7 | 1 ⇒ H-bonus; 6-7 ⇒ H-sum |
| Silver — everything else | ASPD | 3★ | 4-7 | 1-4 | 5-11 | 1-3 ⇒ H-bonus; 8-11 ⇒ H-sum |
| Silver — everything else | ASPD | 4★ | 6-10 | 1-5 | 7-15 | 6 ⇒ H-initial; 1-5 ⇒ H-bonus; 11-15 ⇒ H-sum |
| Silver — everything else | ASPD | 5★ | 8-12 | 1-6 | 9-18 | 8 ⇒ H-initial; 1-6 ⇒ H-bonus; 13-18 ⇒ H-sum |
| Silver — everything else | ASPD% | 1★ | 1-2 | 1 | 2-3 | 3 ⇒ H-sum |
| Silver — everything else | ASPD% | 2★ | 2-5 | 1-2 | 3-7 | 1 ⇒ H-bonus; 6-7 ⇒ H-sum |
| Silver — everything else | ASPD% | 3★ | 4-7 | 2-4 | 6-11 | 5 ⇒ H-initial; 2-3 ⇒ H-bonus; 8-11 ⇒ H-sum |
| Silver — everything else | ASPD% | 4★ | 6-11 | 3-4 | 9-15 | 6-8 ⇒ H-initial; 3-4 ⇒ H-bonus; 12-15 ⇒ H-sum |
| Silver — everything else | ASPD% | 5★ | 9-13 | 3-5 | 12-18 | 9-11 ⇒ H-initial; 3-5 ⇒ H-bonus; 14-18 ⇒ H-sum |
| Silver — everything else | SUR | 1★ | 1-2 | 1 | 2-3 | 3 ⇒ H-sum |
| Silver — everything else | SUR | 2★ | 2-4 | 1-2 | 3-6 | 1 ⇒ H-bonus; 5-6 ⇒ H-sum |
| Silver — everything else | SUR | 3★ | 3-5 | 1-2 | 4-7 | 3 ⇒ H-initial; 1-2 ⇒ H-bonus; 6-7 ⇒ H-sum |
| Silver — everything else | SUR | 4★ | 4-6 | 1-4 | 5-10 | 1-3 ⇒ H-bonus; 7-10 ⇒ H-sum |
| Silver — everything else | SUR | 5★ | 5-7 | 1-5 | 6-12 | 1-4 ⇒ H-bonus; 8-12 ⇒ H-sum |

## Appendix: reproducing the extraction

The tables here were produced by throwaway scripts; the real implementation is a seed pass, specified in the Enhancement Oracle plan. To redo it:

1. Fetch `https://wizardry.info/daphne/gacha_rates/en/alternations.html`. A browser `User-Agent` is required; the default gets a 403.
2. Walk the document in order so each `<table>` inherits the `<h1>`/`<h2>` above it. Identify the value tables by header shape — `Quality`, `Additional Blessings`, then N numeric columns — the same match-by-shape rule `equipmentBlessingDropRate.parser.ts` already uses. Column counts differ per table (16 to 47) and the first column is not always `1`, so read each value from the header text, never from the position.
3. Rows carry `Quality` with a `rowspan` of 19; `-` means impossible, not missing.
4. Derive the bonus from the supports, reconvolve to verify, then compare against the guide.
