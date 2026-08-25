# Alteration & Refinement Stones

What **Alteration Stones**, **Refinement Stones**, and the two **Full Alteration Stones** do to a piece's blessings, and where every number here comes from. This is the companion to [`docs/milestone-blessings.md`](./milestone-blessings.md), which covers what *enhancing* does — read that one first for the model of blessings, slots, quality and grade. This document assumes all of it.

**Notation.** `⊛` is **convolution**: `A ⊛ B` is the distribution of `a + b`, where `a` and `b` are rolled independently from `A` and `B`. Plainly, *"roll one, roll the other, add them."* So `drop ⊛ bonus` means a drop-value roll plus an independent bonus roll, and `drop ⊛ bonus ⊛ bonus` adds two independent bonus rolls. In code it is `convolve()` in `packages/shared/src/domain/enhancementMath.ts`.

**"Bonus".** One distribution, two roles — a **milestone bonus** from enhancing to +5`n`, and a **FAS bonus** from a Full Alteration Stone. Independent draws from the same range, which is why a slot carrying both reads `drop ⊛ bonus ⊛ bonus`. See [`milestone-blessings.md`](./milestone-blessings.md) for the derivation.

**Basis.** The *rates* are official: both source pages state that stone values are drawn with equal probability, so every stone is uniform over its range. The *ranges* are our own, confirmed in game cell by cell on **2026-08-23**. **When each stone table applies is also official** — `alternations.html` states the per-slot conditions verbatim above both stone sections, which is what makes the timing and per-slot rules below statements of the published rule rather than inference; see [When each table applies](#when-each-table-applies--the-source-says-so-outright). The [Fasterthoughts guide](https://wizardry.fasterthoughts.io/equipment/blacksmithing/) publishes matching numbers and is a useful cross-check, but no number here is taken from it — the same relationship `milestone-blessings.md` already describes.

## Why the ranges aren't scraped

The official pages publish the *rule* but not the *data*. `alternations.html`'s "Drop Rates When Using an Alteration Stone" section is one sentence plus a three-row illustrative table; `refinements.html` is a 2 KB page with the same shape. Neither lists per-blessing ranges, because it doesn't need to — **each stone states its own range in its item name** (`Alteration Stone (Attack Power +1-3%)`). The ranges are therefore public, observable facts that simply aren't collected anywhere convenient.

So they live as static reference data in `packages/shared/src/domain/stoneValues.ts`, alongside `grade.ts` and `quality.ts` — which likewise have no Prisma model and are never seeded. Twenty numbers, reviewable in a diff, with the protocol below for re-checking them after a patch.

## The value table

One table serves **both** Alteration and Refinement Stones.

| Blessing group | ★1 | ★2 | ★3 | ★4 | ★5 |
|---|---|---|---|---|---|
| Flat | 1-3 | 2-4 | 3-5 | 4-6 | 5-7 |
| Percent (%) | 1-2 | 1-3 | 2-4 | 3-5 | 4-6 |
| ASPD, SUR | 1-2 | 2-3 | 3-4 | 3-5 | 4-6 |
| ASPD% | 1-2 | 1-3 | 2-4 | 3-5 | 3-6 |

The 19 blessings partition into those four bands as 8 / 8 / 2 / 1.

**ASPD and SUR share a band here but not in the drop tables**, where their ranges genuinely differ (Worn–Ebonsteel ASPD `1-2/2-4/4-6/6-8/8-10` against SUR `1-2/2-3/3-4/4-5/5-6`). That is a real difference between the two mechanics, not a transcription slip — don't "fix" it.

**The ★ is the stone's, not the equipment's.** A piece's quality decides the *common* result when you extract from it, but extraction can roll **up to two tiers higher**: a 3★ piece can yield a 3★ (common), 4★ (rare) or 5★ (very rare) stone. So the stone's star rating is something a player tells us, never something we derive from the gear.

## What each stone does

**Alter** replaces a blessing's identity, its value, and any refinement on that slot. **Only one blessing per equipment may be altered.** The timing matters:

- Altered **before** that slot's milestone checkpoint — the later milestone still adds its milestone bonus as normal.
- Altered **after** its checkpoint — the stone's value replaces the initial roll, any refinement, *and* the enhancement increase, and the slot is **never enhanced again**. It can still be refined.

That asymmetry is why altering is generally done before enhancing past the relevant milestone.

**Refine** adds value on top of a blessing. **Every blessing can be refined**, one refinement stone each; refining a slot again replaces its earlier refinement. Since game version 1.12.1, refinement is **retained** through enhancement (it used to be cleared, which could make a value appear to get worse when a piece was enhanced).

**Lesser Full Alteration Stone (LFAS)** and **Full Alteration Stone (FAS)** re-roll **every** blessing on the item — identities as well as values — wiping refinements and any prior alteration, and **unlocking one alteration again**. Using a second stone repeats the whole process *without adding anything on top of it*: each FAS grants its FAS bonus once, to the roll it generates, so a second FAS re-rolls from exactly the same bands as the first. FAS bonuses do not accumulate across stones, however many are spent.

They differ by **exactly one bonus, on the slots that held a blessing at drop**. "LFAS act just the same as FAS except they do not apply a bonus blessing". What a FAS adds is its own bonus on top, and only to rolls the stone itself generated, never to a slot altered afterwards. See the per-slot table below.

Because every stone that grants a fresh alteration first wipes the previous one, **at most one slot is ever in the "altered" state.** Alterations cannot accumulate.

**The identities are re-rolled on the same odds as a fresh drop.** Which blessing a slot lands on after a stone comes from the same per-slot distribution that governs a blessing appearing when junk is reversed, or when a milestone fills an empty slot — `EquipmentBlessingDropRate`, keyed by `(equipment, slot, blessing)`, which we already hold. So a stone needs no identity data of its own: the Enhancement Oracle re-uses those rows verbatim, and only the *value* side of a stone differs from a drop.

**The exception: fixed-blessing-type equipment.** Some pieces have fixed blessing types, so a stone re-rolls only their values. The known examples as of 2026-08-25 are the 4★ class rings (Master Fighter Ring and its Thief, Mage, Knight, etc. counterparts), the FFXI collab **Relic** items, and the Battlefront Arena **Heavy Warblade of Honor** — the last fixed on its **first two slots only**. These are detectable from data we already hold — a fixed-type slot is one whose `EquipmentBlessingDropRate` row carries a single blessing at rate `1.0`. That check is **per slot**, so a partially-fixed piece like the Warblade needs no special case: slots 1-2 read as fixed and slots 3-4 as free, which is exactly how it behaves.

## Why the published LFAS/FAS tables have the shapes they do

`milestone-blessings.md` verified, 380/380, that the two published tables are `lfas = drop ⊛ bonus` and `fas = drop ⊛ bonus ⊛ bonus`.

### When each table applies — the source says so outright

Both stone sections of `alternations.html` carry the same preamble above their tables, and it is the load-bearing rule for this entire document. Verbatim (the Full Alteration Stone copy; the Lesser one differs only in the stone's name):

> These are the drop rates for the Additional Blessing Values granted when Full Alteration Stones are used on equipment of Grade 2 or higher. These rates apply only when the conditions for each of the Applicable Additional Blessing Slots listed below are met. **In all other cases, Additional Blessing Value Drop Rates by Equipment Rank will apply.**
>
> [Applicable Additional Blessing Slots]
> - Additional Blessing Slot 1: Initial equipment Grade 2 or higher and enhancement level +5 or higher
> - Additional Blessing Slot 2: Initial equipment Grade 3 or higher and enhancement level +10 or higher
> - Additional Blessing Slot 3: Initial equipment Grade 4 or higher and enhancement level +15 or higher
> - Additional Blessing Slot 4: Initial equipment Grade 5 or higher and enhancement level +20 or higher
>
> \*This does not apply to Grade 1 equipment that has become Grade 2 after enhancement.

Two conditions on **slot `n`**:

1. **Initial grade ≥ `n`+1** — i.e. the slot held a blessing **at drop**. Grade 2 is one blessing, Grade 5 is four, so "Grade `n`+1 or higher" is exactly "slot `n` was occupied". The footnote nails it down as grade *at drop*: a White piece that reached Grade 2 by enhancing does not qualify. This condition is about the **equipment**, and it is the reason a milestone-filled slot falls back to plain `drop` under either stone.
2. **Enhancement level ≥ +5`n`** — the slot's own milestone has already been reached when the stone is used. This condition is about **which published table describes the result**, not about what the stone grants.

**Read the second condition carefully — it is easy to over-read.** It does *not* say a Full stone withholds its bonus from an un-enhanced piece. It says these published *numbers* only describe a slot that has both the milestone bonus and the stone's own. `fas` is `drop ⊛ bonus ⊛ bonus`; a red piece FAS'd at +0 sits at `drop ⊛ bonus`, one term short, because there is no milestone yet to re-apply — and the page publishes no table for that intermediate state, so it points at the by-rank table instead. That fallback is exact for a **Lesser** stone in both failure modes; for a Full one it is loose, and the two paragraphs are byte-identical apart from the stone's name, so it was written for the Lesser case and templated across. **The bonus itself is unconditional** — confirmed by repeated in-game use of FAS on red pieces at +0, where it rolls every time.

The support corroborates the first reading independently. For `RANK_1_5`, quality 3, flat, `drop` is `5-7` while `lfas` is `7-15`: if the `lfas` table also covered slots stoned before their milestone, its support would have to include 5 and 6. It does not, and its shape is exactly the trapezoid `U{5,6,7} ⊛ U{2..8}` — one clean convolution, not a blend of two scenarios. The table describes one situation, which is what condition 2 is telling you.

Given all that, the LFAS-versus-FAS difference is one bonus on a qualifying slot: a LFAS returns it to `drop ⊛ bonus` — exactly the enhancement it had already earned — while a FAS adds its own bonus on top, giving `drop ⊛ bonus ⊛ bonus`. **That is the "double-dip": the stone re-applies the milestone bonus onto a fresh base roll and then adds a second bonus of the same size.**

### The re-application is per *slot*, not per piece

The first of the two conditions is per slot, so a single stone can put different slots on different tables. Taking a stone used at **+20**, where every slot's enhancement clause is satisfied:

| slot state at drop | after a LFAS | after a FAS |
|---|---|---|
| occupied (slot index ≤ grade − 1) | `drop ⊛ bonus` — the published **`lfas`** table | `drop ⊛ bonus ⊛ bonus` — the published **`fas`** table |
| empty, milestone-filled | `drop` — the published **`drop`** table | `drop` — the published **`drop`** table |

**A FAS bonuses only the slots that were occupied at drop.** It is the same entitlement the milestone uses, so a slot that was empty at drop is re-rolled by either stone and bonused by neither. The published `fas` table therefore describes an occupied slot and nothing else.

So which table applies is chosen **per slot**. The consequence worth internalising: **a LFAS is exactly value-neutral.** It re-rolls a piece into what that piece would naturally be given its starting grade — the gamble is on blessing *identities*, not values. A FAS is that plus one FAS bonus on the slots that were occupied at drop, and nothing at all on the rest.

### The evidence

From https://discord.com/channels/1296602475918524507/1306818982078054400/1510712778241998928, on the community Discord.

**One observation, and the stone was a Lesser one.** A **4★ Steel Ring of the Warrior Princess** (`RANK_1_5`, quality 4), started blue with 2 blessings, enhanced to +20, then **LFAS'd** — stated as such by the reporter. The published bands for that cell are `drop 8-10` and `lfas 11-20` for flat blessings:

| slot | result | in `drop` (8-10) | in `lfas` (11-20) |
|---|---|---|---|
| 1 — ACC+12 | occupied at drop | no | **yes** |
| 2 — RES+17 | occupied at drop | no | **yes** |
| 3 — ATK+8 | milestone-filled | **yes** | no |
| 4 — MAG+12% | milestone-filled | yes | yes (ambiguous) |

Slots 1–2 are impossible *without* a milestone bonus; slot 3 is impossible *with* one. One stone, two distributions on the same item, split exactly along occupied-versus-filled. It also pins the starting grade independently: at least two slots carried a milestone bonus and at most two did, so exactly two — blue, as reported.

That "ATK+8" is also the classic confusion this document exists to prevent, and the reporter's question above is that confusion verbatim. Nothing went wrong: slot 3 was milestone-filled, so it never had a milestone bonus to restore, and 8 is simply the floor of its band.

The numbers corroborate the reporter's word on their own: no assignment of `12, 17, 8, 12%` to four slots works under a Full stone. Under the model here a FAS'd occupied slot floors at `14` (`8+3+3`), which ACC+12 is below; under the older bonus-on-every-slot reading a FAS'd milestone-filled slot floors at `11`, which ATK+8 is below. Useful to know because it means the LFAS rows stand on the data alone, not on a recollection.

**This is the whole of our direct evidence: one item, one stone, and that stone a Lesser one.** Since the source states the conditions outright, it is no longer load-bearing — it is a spot-check that the published rule behaves in game as written, which it does, exactly. Note that nothing here observes a Full stone; every FAS statement in this document rests on the source's own conditions plus its published table, both of which are identical in wording to the Lesser ones.

### What that means in practice

Taking `RANK_1_5`, quality 3, flat ATK as the worked example — `drop` 5-7, `bonus` 2-8:

| slot | before any stone, at +20 | after LFAS | after FAS |
|---|---|---|---|
| occupied at drop | `7-15` | `7-15` — unchanged | `9-23` — one bonus better |
| milestone-filled | `5-7` | `5-7` — unchanged | `5-7` — unchanged |

Three things worth stating plainly, because the intuitive guesses all miss:

- **A LFAS changes no slot's value distribution at all.** Every slot lands exactly where that slot would naturally sit for a piece of this grade at +20. It is not a downgrade, and it is not an upgrade — you are paying a stone to re-roll *which blessings you have*, at unchanged odds on their values.
- **A FAS improves only the slots that were occupied at drop**, by exactly one bonus each. A milestone-filled slot is re-rolled but not bonused, so it comes back on the same `drop` band it already had — the same as under a LFAS.
- **A milestone-filled slot always looks weaker, and that is correct.** It never earned a milestone bonus, so it sits a full bonus below its neighbours before any stone and **two** after a FAS. Slots 3–4 reading low on a blue piece is the system working, not a bad roll.

**The bonus follows the same rule as the milestone: both are earned only by a slot that held a blessing at drop.** That one sentence is the whole per-slot model — grade at drop decides which slots collect extra rolls, and a FAS raises the ceiling only on those.

### Timing: before or after enhancing

**Timing changes nothing about a slot's final value.** What a stone writes depends on what the slot has already *earned*, but the milestone it has not yet earned still arrives later, so both orders converge.

What a stone writes, per slot:

| | slot occupied at drop | slot empty at drop, milestone not yet reached | slot empty at drop, already milestone-filled |
|---|---|---|---|
| **LFAS** | `drop` + the milestone bonus if already earned | nothing | `drop` |
| **FAS** | `drop` + the milestone bonus if already earned + FAS bonus | nothing | `drop` |

The FAS bonus is granted **unconditionally** — it does not wait on the slot's milestone. What waits on the milestone is the *milestone* bonus, and only because a slot cannot have re-applied to it something it has not yet earned.

So for slot 1, occupied at drop, `RANK_1_5` quality 3 flat:

| | at the moment the stone lands | after enhancing to +20 |
|---|---|---|
| **FAS at +0** | `drop` + FAS bonus ⇒ `7-15` | the +5 milestone adds its bonus ⇒ **`9-23`** |
| **FAS at +20** | `fas` table ⇒ **`9-23`** | `9-23`, nothing left to add |
| **LFAS at +0** | plain `drop` ⇒ `5-7` | the +5 milestone adds its bonus ⇒ **`7-15`** |
| **LFAS at +20** | `lfas` table ⇒ **`7-15`** | `7-15` |

Identical endpoints in both orders, for both stones. A slot **empty at drop** ends on plain `drop` under every combination — before its milestone the stone passes over it, after its milestone it is re-rolled but never bonused.

So, for a +20 equipment, we can see these effects on their slots:
| | slot occupied at drop | slot empty at drop |
|---|---|---|
| FAS, either order | `drop ⊛ bonus ⊛ bonus` | `drop` |
| LFAS, either order | `drop ⊛ bonus` | `drop` |

**What timing does change is information, not range.** A stone at +0 shows you the base rolls before you commit enhancement materials, so a bad piece can be abandoned cheaply; a stone at +20 re-rolls base and milestone together, so a good base cannot be kept while the rest is re-rolled. That is a control argument, and it costs nothing on the value side.

## The value model

A slot's **final** value — after every remaining milestone — is a sum of independent rolls:

```
value  =  base  ⊛  [refine]  ⊛  [bonus]
```

Implemented as `composeSlotValue()` in `enhancementMath.ts`. Two rules decide what goes in:

**Which `base`** — whatever roll last set the slot:

| situation | base |
|---|---|
| never altered or stone-rerolled | the `drop` distribution |
| altered | the Alteration Stone's uniform range |
| LFAS, slot occupied at drop | the `lfas` distribution if that slot's milestone has passed, else `drop` |
| FAS, slot occupied at drop | the `fas` distribution if that slot's milestone has passed, else `lfas` |
| LFAS/FAS, slot empty at drop | the `drop` distribution either way |

The two occupied-slot rows split on **when** the stone was used, because each published table bakes in the milestone bonus and a stone cannot re-apply one the piece has not yet earned. A FAS still grants its own bonus in the "else" case, which is why that cell is `lfas` and not `drop` — see [Timing](#timing-before-or-after-enhancing). The `bonus` rule below supplies the milestone in both "else" cases, so either order lands on the same distribution.

**Whether a milestone enhancement `bonus` applies** — only if the slot is entitled to one *and* its checkpoint falls after whatever set its base:

| situation | bonus |
|---|---|
| slot empty at drop, never altered | never — its milestone *fills* the slot, it does not boost it |
| slot occupied at drop, `drop` base | always — the checkpoint is always later |
| altered before its checkpoint | applies |
| altered after its checkpoint | never, permanently — that slot is done being enhanced |
| LFAS/FAS used before the checkpoint, slot occupied at drop | applies — that milestone still lies ahead |
| LFAS/FAS used at or after the checkpoint | never — the stone's own table already includes that milestone bonus, and adding one here would count it twice |

`refine` is present whenever the slot carries a refinement stone.

## Appendix: re-verifying the ranges

Kept so the table can be re-checked after a patch if needed.

**The ranges need no experiment at all** — a stone states its range in its own item name. Open the inventory, read any Alteration or Refinement Stone, and confirm its stated range against the row for its blessing group and star rating. Ten stones spread across the four bands is enough to catch a table-wide change.

**The per-slot rule.** Take a blue (grade 3) piece to +20 and apply either stone, then test each blessing against the bands for its group and quality: slots 3-4 should land inside plain `drop` under **either** stone, while slots 1-2 clear the `drop` ceiling. A single flat blessing landing below the `lfas` floor on slot 3 — or above the `drop` ceiling on slot 1 — settles it, as it did for the Ring of the Warrior Princess above. No stone needs to be spent deliberately; any player screenshot of a stoned item works, provided the piece's rank, quality and starting grade are known.

**To re-confirm the alteration timing rule**, alter a slot after its checkpoint and verify the value sits inside the plain stone range with no milestone bonus on top.

**Still open:**

- **The `+5n` boundary, read strictly.** The conditions say "enhancement level +5 or higher", so a piece sitting exactly at +5 qualifies for slot 1. Worth confirming once that the boundary is inclusive as written rather than "past" the milestone.
