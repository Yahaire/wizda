# Alteration & Refinement Stones

What **Alteration Stones**, **Refinement Stones**, and the two **Full Alteration Stones** do to a piece's blessings, and where every number here comes from. This is the companion to [`docs/milestone-blessings.md`](./milestone-blessings.md), which covers what *enhancing* does — read that one first for the model of blessings, slots, quality and grade. This document assumes all of it.

**Notation.** `⊛` is **convolution**: `A ⊛ B` is the distribution of `a + b`, where `a` and `b` are rolled independently from `A` and `B`. Plainly, *"roll one, roll the other, add them."* So `drop ⊛ increment` means a drop-value roll plus an independent increment roll, and `drop ⊛ increment ⊛ increment` adds two independent increments. In code it is `convolve()` in `packages/shared/src/domain/enhancementMath.ts`.

**Basis.** The *rates* are official: both source pages state that stone values are drawn with equal probability, so every stone is uniform over its range. The *ranges* are our own, confirmed in game cell by cell on **2026-08-23**. The [Fasterthoughts guide](https://wizardry.fasterthoughts.io/equipment/blacksmithing/) publishes matching numbers and is a useful cross-check, but no number here is taken from it — the same relationship `milestone-blessings.md` already describes.

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

- Altered **before** that slot's milestone checkpoint — the later milestone still adds its increment as normal.
- Altered **after** its checkpoint — the stone's value replaces the initial roll, any refinement, *and* the enhancement increase, and the slot is **never enhanced again**. It can still be refined.

That asymmetry is why altering is generally done before enhancing past the relevant milestone.

**Refine** adds value on top of a blessing. **Every blessing can be refined**, one refinement stone each; refining a slot again replaces its earlier refinement. Since game version 1.12.1, refinement is **retained** through enhancement (it used to be cleared, which could make a value appear to get worse when a piece was enhanced).

**Lesser Full Alteration Stone (LFAS)** and **Full Alteration Stone (FAS)** re-roll **every** blessing on the item — identities as well as values — wiping refinements and any prior alteration, and **unlocking one alteration again**. Using a second stone repeats the whole process.

They differ by **exactly one increment on every slot**. The community phrasing is that "a FAS re-applies Milestone Blessing bonuses and an LFAS does not", which is easy to misread: an LFAS *does* restore the enhancement an occupied slot had already earned — it simply adds nothing beyond that. What a FAS adds is a *bonus* increment on top, and only to rolls the stone itself generated, never to a slot altered afterwards. See the per-slot table below.

Because every stone that grants a fresh alteration first wipes the previous one, **at most one slot is ever in the "altered" state.** Alterations cannot accumulate.

**The exception: fixed-blessing-type equipment.** Some pieces (the 4★ Master Fighter Ring is the standard example) have fixed blessing types, so a stone re-rolls only their values. These are detectable from data we already hold — a fixed-type slot is one whose `EquipmentBlessingDropRate` row carries a single blessing at rate `1.0`.

## Why the published LFAS/FAS tables have the shapes they do

`milestone-blessings.md` verified, 380/380, that the two published tables are `lfas = drop ⊛ increment` and `fas = drop ⊛ increment ⊛ increment`.

**All three published tables describe a slot that was occupied at drop.** A slot that was *milestone-filled* follows a different column entirely (below). Missing this is what makes a freshly-stoned item look broken to players ("Slot 3 has only 8 atk after LFAS at +20!" when the equipment was blue and, thus, slot 3 was empty at drop).

Given that, the LFAS-versus-FAS difference is simply one increment: an LFAS returns an occupied slot to `drop ⊛ increment` — exactly the enhancement it had already earned — while a FAS adds one bonus increment on top, giving `drop ⊛ increment ⊛ increment`.

### The re-application is per *slot*, not per piece

A FAS re-applies to each slot **whatever that slot was actually entitled to**. A slot occupied at drop earns an increment at its milestone; a slot that was *empty* at drop is merely **filled** by its milestone and gets a plain initial roll with no increment (`milestone-blessings.md`, "Settling the empty-slot case"). So:

| slot state at drop | after an LFAS | after a FAS |
|---|---|---|
| occupied (slot index ≤ grade − 1) | `drop ⊛ increment` — the published **`lfas`** table | `drop ⊛ increment ⊛ increment` — the published **`fas`** table |
| empty, milestone-filled | `drop` — the published **`drop`** table | `drop ⊛ increment` — the published **`lfas`** table (inferred) |

So which table applies is chosen **per slot**, and a stone shifts every slot by the same one increment relative to what that slot naturally had. The consequence worth internalising: **an LFAS is exactly value-neutral.** It re-rolls a piece into what that piece would naturally be given its starting grade — the gamble is on blessing *identities*, not values. A FAS is that plus one bonus increment everywhere, which is the "double-dip".

### The evidence

From https://discord.com/channels/1296602475918524507/1306818982078054400/1510712778241998928, on the community Discord.

Two independent observations on different pieces, ranks and stones:

1. A 3★ blue piece taken to +20 and FAS'd shows **slots 1–2 sitting clearly above slots 3–4**.
2. A **4★ Steel Ring of the Warrior Princess** (`RANK_1_5`, quality 4), started blue with 2 blessings, enhanced to +20, then **LFAS'd**. The published bands for that cell are `drop 8-10` and `lfas 11-20` for flat blessings:

| slot | result | in `drop` (8-10) | in `lfas` (11-20) |
|---|---|---|---|
| 1 — ACC+12 | occupied at drop | no | **yes** |
| 2 — RES+17 | occupied at drop | no | **yes** |
| 3 — ATK+8 | milestone-filled | **yes** | no |
| 4 — MAG+12% | milestone-filled | yes | yes (ambiguous) |

Slots 1–2 are impossible *without* an increment; slot 3 is impossible *with* one. One stone, two distributions on the same item, split exactly along occupied-versus-filled. It also pins the starting grade independently: at least two slots carried an increment and at most two did, so exactly two — blue, as reported.

That "ATK+8" is also the classic confusion this document exists to prevent. Nothing went wrong: slot 3 was milestone-filled, so it never had an increment to restore, and 8 is simply the floor of its band.

### What that means in practice

Taking `RANK_1_5`, quality 3, flat ATK as the worked example — `drop` 5-7, `increment` 2-8:

| slot | before any stone, at +20 | after LFAS | after FAS |
|---|---|---|---|
| occupied at drop | `7-15` | `7-15` — unchanged | `9-23` — one increment better |
| milestone-filled | `5-7` | `5-7` — unchanged | `7-15` — one increment better |

Three things worth stating plainly, because the intuitive guesses all miss:

- **An LFAS changes no slot's value distribution at all.** Every slot lands exactly where that slot would naturally sit for a piece of this grade at +20. It is not a downgrade, and it is not an upgrade — you are paying a stone to re-roll *which blessings you have*, at unchanged odds on their values.
- **A FAS improves every slot by exactly one increment**, occupied or milestone-filled alike. That uniform shift is the whole difference between the two stones.
- **A milestone-filled slot always looks weaker, and that is correct.** It never earned an increment, so it sits a full increment below its neighbours both before and after any stone. Slots 3–4 reading low on a blue piece is the system working, not a bad roll.

### Using a stone before enhancing

The game *"will remember the item's Grade or Color"* — grade, not enhancement level. So the re-application keys off which slots were occupied **at drop**, independent of how far the piece has been enhanced, and a checkpoint that has not yet been passed still adds its own increment afterwards. FAS an un-enhanced piece and then enhance it and an occupied slot reaches `drop ⊛ increment³` — `11-31` in the worked example, against a natural ceiling of `7-15`. This is what the community calls the "double-dip".

⚠️ **That last row is inference, not observation.** It follows from the grade wording above and from the guide's double-dip claim, but we have not confirmed it in game — a Full Alteration Stone is far too rare to spend on a test piece. Everything else in this document is either official or directly observed.

## The value model

A slot's **final** value — after every remaining milestone — is a sum of independent rolls:

```
value  =  base  ⊛  [refine]  ⊛  [increment]
```

Implemented as `composeSlotValue()` in `enhancementMath.ts`. Two rules decide what goes in:

**Which `base`** — whatever roll last set the slot:

| situation | base |
|---|---|
| never altered or stone-rerolled | the `drop` distribution |
| altered | the Alteration Stone's uniform range |
| LFAS, slot occupied at drop | the `lfas` distribution |
| LFAS, slot milestone-filled | the `drop` distribution |
| FAS, slot occupied at drop | the `fas` distribution |
| FAS, slot milestone-filled | the `lfas` distribution |

**Whether `increment` applies** — only if the slot's checkpoint falls *after* whatever set its base:

| situation | increment |
|---|---|
| `drop` base | always — the checkpoint is always later |
| altered before its checkpoint | applies |
| altered after its checkpoint | never, permanently — that slot is done being enhanced |
| LFAS/FAS used before the checkpoint | applies |
| LFAS/FAS used after the checkpoint | already accounted for in the stone's table |

`refine` is present whenever the slot carries a refinement stone.

## Appendix: re-verifying the ranges

Kept so the table can be re-checked cheaply after a patch.

**The ranges need no experiment at all** — a stone states its range in its own item name. Open the inventory, read any Alteration or Refinement Stone, and confirm its stated range against the row for its blessing group and star rating. Ten stones spread across the four bands is enough to catch a table-wide change.

**The per-slot rule is cheap to re-check on any stoned piece.** Take a blue (grade 3) piece to +20 and apply either stone, then test each blessing against the bands for its group and quality: slots 1–2 should carry one more increment than slots 3–4. A single flat blessing landing below the `lfas` floor on slot 3 — or above the `drop` ceiling on slot 1 — settles it, as it did for the Ring of the Warrior Princess above. No stone needs to be spent deliberately; any player screenshot of a stoned item works, provided the piece's rank, quality and starting grade are known.

**To re-confirm the alteration timing rule**, alter a slot after its checkpoint and verify the value sits inside the plain stone range with no increment on top.

**Still open:**

- The un-enhanced FAS case flagged above (`drop ⊛ increment³`), which needs a spare Full Alteration Stone and a piece worth burning it on.
- The FAS row for a **milestone-filled** slot. It is inferred by symmetry with the observed LFAS behaviour — a FAS shifting every slot up one increment — but only the LFAS half has been seen directly.
