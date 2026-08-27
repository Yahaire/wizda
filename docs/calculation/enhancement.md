# Enhancement Oracle calculation

How Wizda answers the Enhancement Oracle's question: **"I have this piece — if I enhance it, what are the odds a blessing I care about ends up at the number I want?"**

Read [`docs/milestone-blessings.md`](../milestone-blessings.md) first for what enhancing does to a blessing's value, and [`docs/stones.md`](../stones.md) for what Alteration and Refinement Stones do. This document assumes both and covers only the calculation on top of them.

The pure implementation lives in `packages/shared/src/domain/enhancementMath.ts` and `blessingSlots.ts` (Prisma-free, unit-tested). How those fit into the API — the "DB reads, the math module computes" split — is in [`docs/architecture.md`](../architecture.md).

**Notation.** `⊛` is convolution: `A ⊛ B` is the distribution of `a + b` with `a` and `b` drawn independently. Plainly, *"roll one, roll the other, add them."*

## What the player tells us

Mostly what the item screen shows: the piece, its quality, its enhancement level, and per slot a blessing and a number. Plus what they intend — how far they mean to enhance, and which blessings they want at which values.

The player may also optionally share what they remember about each slot. Particularly, if they altered it, what blessing it had beforehand to help with accurate calculations.

Everything else is either inferred or genuinely irrelevant. Which is the surprising part, so it gets its own section.

### Why full history isn't asked for

It is tempting to ask how each slot got its number — was it the drop roll, an Alteration Stone, a Full Alteration Stone; is it refined; was it occupied when the piece dropped. **None of it changes the answer**, because the number on screen already contains all of it, and what enhancing will *add* depends on two things only:

```
a slot gains a future milestone bonus  <=>  the slot is occupied now
                                       AND  5 * slot > enhancementLevel
```

Checking that against [`docs/stones.md`](../stones.md)'s own "whether a milestone bonus applies" table, every row collapses into it:

| the table's case | why the rule above already covers it |
|---|---|
| occupied at drop, plain `drop` base | occupied now, checkpoint ahead → bonus |
| altered **before** its checkpoint | occupied now, checkpoint ahead → bonus |
| LFAS/FAS used before the checkpoint | occupied now, checkpoint ahead → bonus |
| altered **after** its checkpoint | the checkpoint has passed → no bonus |
| LFAS/FAS used at or after the checkpoint | the checkpoint has passed → no bonus |
| empty at drop, never altered | the slot is either still empty (a milestone *fills* it, and a filled slot is never also bonused) or was filled by its own passed milestone → no bonus either way |

The last row is the only one needing an argument: could a slot that was empty at drop be *occupied now* with its milestone still ahead? No — nothing else can put a blessing in a slot. A milestone fills it (which is the checkpoint), an Alteration Stone replaces a blessing already there, and a Full/Lesser stone re-rolls blessings the piece already has. So the case cannot arise.

**Worked example**, 3★ Silver "everything else" (flat drop `5-8`, bonus `2-10`; SUR drop `3-5`, bonus `1-2`; ★3 Refinement Stone: flat `3-5`, SUR `3-4`), asked at **+5 with SUR already refined**:

| | slot 1 (ATK) | slot 2 (SUR) |
|---|---|---|
| at drop | `5-8` | `3-5` |
| the +5 milestone | `+ 2-10` → `7-18` | untouched |
| refined ★3 | — | `+ 3-4` |
| **on screen at +5** | 7-18 | **6-9** |
| still to come | no more bonues, but an optional refinement | the +10 bonus, `1-2` |

A reported SUR of 9 answers `9 + Uniform(1, 2)`, which is exactly `drop ⊛ refine ⊛ bonus` — reached without being told about the refinement, because the refinement is inside the 9.

**What history *is* good for** is reading a number back: unrefined, SUR at +5 tops out at 5, so a 9 must be refined (or a typo). That's an inference the client makes from the reference endpoint's bands, and it doubles as a data-entry check. Where two histories both explain a number, they imply the same future, so the ambiguity costs nothing.

**The one exception** is a *planned* refinement on a slot that is already refined: a new stone replaces the old one, so the existing refinement would have to be subtracted back out of the displayed value. That needs the base's own composition, so it is rejected with `ALREADY_REFINED` rather than guessed at.

And because it is the one place history changes the answer, it is the one place we **ask** rather than infer: `planRefineStoneQuality` requires `isRefined` alongside it. The displayed value alone cannot always settle it — a past Full Alteration Stone raises what a slot can reach unrefined, and this query never asks about stones — so an unstated `isRefined` is rejected instead of assumed. A value above even the generous unrefined ceiling still overrides an `isRefined: false`: trust the number over the flag.

### Grade: two of them, and only one is asked for

The game has an **initial** grade (what the piece was when obtained) and a **current** grade. `alternations.html`'s stone conditions say "Initial equipment Grade `n`+1 or higher", and its footnote — *"This does not apply to Grade 1 equipment that has become Grade 2 after enhancement"* — exists precisely because milestone fills raise the displayed grade.

- **Current grade** is exactly `1 + filled slots`, so the per-slot state already states it. It is never an API field.
- **Initial grade is not always recoverable** from current state: a blue-at-drop piece at +15 and a White-at-drop piece at +15 both show three filled slots. You can only easily recover it from a +0 piece.

`initialGrade` is accepted but **does not change the probability** — every input the calculation touches is fixed by current state. It earns its place two other ways: it cross-checks the reported slots (a grade `g` piece at +`n` carries `max(g − 1, n / 5)` blessings), and it lets the client tell a milestone-filled slot from one occupied at drop when labelling a value, which sharpens the bands considerably. It is also what the future Build Paths view needs, since a Full Alteration Stone bonuses only the slots that were occupied at drop.

The inertness is structural — `EnhancementOddsInput` has no `initialGrade` field at all, so the math cannot consult it — and was confirmed against the live API: the same query at `initialGrade` 1, 3, 4 and omitted returns an identical probability to the last digit.

## The calculation

### Per-slot value

| slot state | final value |
|---|---|
| occupied, `5 * slot# ≤ enhancementLevel` | the displayed value, already final |
| occupied, `5 * slot# > targetEnhancementLevel` | the displayed value — the player isn't going that far |
| occupied, `5 * slot#` is a remaining milestone | `value ⊛ bonus` |
| empty, `5 * slot#` is a remaining milestone | `drop` — **no bonus** |
| empty, `5 * slot# > targetEnhancementLevel` | stays empty |

Then `⊛ Uniform(stone range)` on any slot carrying a planned refinement. `bonus` is the derived milestone bonus from `BlessingValueBonus`; `drop` is the published `DROP` value table. Both are keyed by `(value group, quality, blessing)`.

The "empty slot gets `drop` and no bonus" row is the one number on the site not traceable to a published table — it comes from our own in-game testing, and every answer that leans on it says so (`EMPTY_SLOT_RULE_EMPIRICAL`). See [`docs/milestone-blessings.md`](../milestone-blessings.md), "Settling the empty-slot case in game".

### Which blessing a milestone puts in an empty slot

The same without-replacement chain the Junk Oracle uses (`blessingSlots.ts`, shared by both):

```
P(b₁ … b_m) = Π_s  rate_s(b_s) / Σ_{x ∉ {b₁ … b_{s−1}}} rate_s(x)
```

with two differences from the Junk Oracle's use of it.

**Slots the player reported are pinned**, and the rest enumerated. A pinned slot keeps its *real* chain factor rather than 1, because a free slot earlier in the chain can consume the very blessing a later pinned slot reports, and those histories are impossible given what was observed. So the answer is a conditional:

```
total = Σ over assignments consistent with the pinned slots  of  P(assignment)
hit   = Σ over those assignments  of  P(assignment) · P(all targets met | assignment)

P(targets | observed) = hit / total
```

That degenerates to a plain product when nothing free precedes anything pinned.

**The chain runs on what each slot *originally* rolled.** This is the load-bearing one, and it is not obvious.

An Alteration Stone changes what a slot *displays* without feeding back into the draw. So a later milestone can land on the blessing an altered slot shows, and a piece ends up carrying the same blessing twice — which happens in ordinary play, both by surprise and deliberately (altering a useless slot into a second copy of something good, accepting the low alter-plus-refine value it will have). Duplicate blessings across slots are therefore legal input, and a target may name the same blessing more than once.

The consequence for the odds is not marginal. Take a blue piece whose slot 1 was ACC at drop and was altered to ATK, and ask for a second ATK:

| | what the chain excludes for slots 3-4 | a second ATK |
|---|---|---|
| the alteration is declared | ACC — what slot 1 *originally* rolled | possible |
| the alteration isn't declared | ATK — what slot 1 *displays* | impossible, `P = 0` |

So `alteredSlot` is a real input, not bookkeeping. `alteredFrom` pins the original when the player remembers it; omitted, the original becomes one more free variable in the same walk and the answer averages over it, flagged `ALTERED_ORIGIN_UNKNOWN`. At most one slot is ever in the altered state, since every stone that grants a fresh alteration first wipes the previous one — so this is one field per piece, not per slot.

**The rule this implements**, stated in [`docs/milestone-blessings.md`](../milestone-blessings.md):

> A milestone fill avoids the piece's *initial* blessings — and a standard Alteration Stone's result is not one of them.

Two consequences the code has to get right, and they pull opposite ways for the same slot:

- The altered slot's **original** blessing stays in the exclusion set, though nothing displays it any more. That is what `alteredFrom` pins, and what the walk marginalises over when it isn't given.
- The blessing the **stone put there** is *not* in the exclusion set, so a later milestone may roll it and hand the piece two copies.

A Lesser or Full Alteration Stone is the opposite case and needs no handling: it re-rolls every blessing on the piece, so afterwards the displayed blessings **are** the initial set and any prior alteration has been wiped. That is exactly what the walk assumes when no slot is declared altered — pin the displayed blessings and draw against them.

### Meeting the targets

Targets are ANDed, and **each is satisfied by a distinct slot**: asking for `ATK ≥ 16` and `ATK ≥ 8` wants two ATK slots, not one good one counted twice.

Different blessings sit in different slots with independent values, so the joint factorises across blessing codes. Within one blessing it is a bipartite matching, and by Hall's theorem a matching exists exactly when, for every `j`, at least `k − j + 1` slots clear the `j`-th smallest threshold. Each slot is reduced to its *level* — how many thresholds its value clears — and the level combinations are enumerated. At most `5⁴`, and reachable at all only when an altered slot has put a duplicate on the piece, since the draw chain never repeats a blessing on its own.

### Bounds

The walk visits at most `19⁴ ≈ 130k` assignments — a White piece at +0 with all four slots free — and is skipped entirely when nothing is free. It is deliberately **unpruned**: the per-slot marginals returned to the client need every assignment, and pruning to the target-covering ones would bias them.

## What comes back

A scalar probability *and* the per-slot distributions: one final value distribution for an occupied slot, and for a slot a milestone will fill, every blessing it could land on with that blessing's odds and value distribution. The client can then move a target threshold and re-score locally with no round trip (`probabilityAtLeast` is exported for exactly this).

Notes come in **two tiers**, and conflating them would make the tool read as less trustworthy than it is:

| tier | what it means | examples |
|---|---|---|
| **note** | how the model works — stable | the empty-slot rule is empirical; slots 2-4 are assumed to behave like slot 1; a milestone avoids what originally rolled |
| **warning** | our data is incomplete right now — temporary | no value group resolved; a bonus failed its reconvolution check; missing value rows |

A normal answer carries notes and no warnings, and is **not** marked `estimated` — unlike the Junk Oracle's blessing queries, these numbers are official. When a warning means the answer would rest on gaps, `probability` is `null` rather than a number computed on missing data.

## The reference endpoint

`GET /enhancement-odds/reference?equipment=<name>&quality=<n>` returns, for one piece: the resolved value group, every blessing's `drop` / `lesserFas` / `fas` bands and derived bonus, and the piece's four per-slot blessing-identity rows. It exists because the client has to bound a value input and label which band a typed number came from *while the player types*, before any odds query exists.

Fetched once per (equipment, quality), so changing a slot's blessing needs no refetch. Stone ranges are deliberately absent — they're static reference data the client already holds in `@shared/domain/stoneValues`.

Its payloads are keyed by source **role** (`drop`/`lesserFas`/`fas`), never by the stored `BlessingValueSource.code`. Those codes are derived from the source page's `<h1>` text, so a reword upstream could change them; `BLESSING_VALUE_SOURCE_CODES` is the single place the mapping lives, and both the parser and the API read it.

`isFixed` marks a slot that always rolls the same blessing (a single rate of `1.0`). It is per slot rather than per piece, so a partially-fixed item like the Heavy Warblade of Honor — fixed on its first two slots only — needs no special case.

## When a query is rejected

Every rejection is a state the game cannot produce, or an ask we can't answer honestly. None of them 500s; missing *data* degrades to a null probability with a warning instead.

| `ErrorCode` | when |
|---|---|
| `UNKNOWN_EQUIPMENT` / `UNKNOWN_BLESSING` | a name or code that isn't in the catalog — these come from selects, so it means a stale client |
| `INVALID_SLOT_STATE` | a gap between filled slots; a slot left empty past its own milestone; an `initialGrade` disagreeing with the filled count |
| `INVALID_QUERY` | a target level below the current one; `alteredSlot` naming an empty slot; `alteredFrom` without `alteredSlot`; a slot given twice; a blessing with no value |
| `ALREADY_REFINED` | a planned refinement on a slot that already carries one (see above) |
| `NO_QUERY` | no targets — there'd be nothing to compute |

The slot rules all follow from slots filling top-to-bottom: a slot holds a blessing iff it was occupied at drop or its own milestone has passed, both prefixes, so the filled slots are a prefix too and its length is `max(initialGrade − 1, level / 5)`. Anything else is a mis-entry rather than an exotic item. `checkBlessingSlotState` is shared, so the client can prevent these states rather than merely have them rejected.

## Validation

The pure math is checked in `enhancementMath.test.ts` and `blessingSlots.test.ts`, over a five-blessing catalogue with equal per-slot rates so every expectation is a fraction checkable by hand rather than by re-running the implementation:

1. **The worked example**, pinned exactly. A 4★ `RANK_1_5` piece at +0 with flat ATK at 8, wanting ATK ≥ 16: the bonus is uniform over `3-10`, so 8, 9 or 10 will do — `3/8`, to the last digit. Confirmed against the live API with a real Ebonsteel Dagger.
2. **The without-replacement chain**: four slots drawn from five equally likely blessings leave exactly one out, so any given blessing appears with probability `4/5`; with one slot already occupied the remaining three share four blessings, giving `3/4`.
3. **The duplicate pair**, which is the regression test for the originals rule. The same blue piece with and without `alteredSlot` must give a positive number and `0` respectively. If the exclusion set is ever "simplified" back to the displayed blessings, the first silently collapses into the second.
4. **The marginalisation**: with `alteredFrom` omitted, the answer must equal the plain mean of the answers for each blessing the slot could originally have been.
5. **`initialGrade` inertness**: the same query with the grade stated and omitted must return the identical probability.
6. **The extraction guard**: `dropRateMath.test.ts` must pass untouched, since `blessingSlots.ts` was lifted out of it and the Junk Oracle's numbers must not move.
