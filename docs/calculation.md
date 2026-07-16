# Wizda drop-rate calculation

How Wizda turns the scraped drop tables into the product's core answer: **"how much junk must I farm to guarantee item X?"** Read `docs/domain.md` first for the game model and data structure — this doc assumes it and focuses on the math.

The pure implementation lives in `packages/shared/src/domain/dropRateMath.ts` (Prisma-free, unit-tested). How that module fits into the API — the "DB reads, the math module computes" split — is in [`docs/architecture.md`](./architecture.md).

## What "guarantee" means

For any target whose per-junk probability `P` is below 1 you can **never** truly guarantee a drop — you can only reach a chosen **confidence**. So "guarantee X" is implemented as "enough junk to hit confidence `c`" (default `c = 0.99`).

Each junk is an independent draw with success probability `P`. The chance of at least one success in `n` draws is `1 − (1 − P)^n`. Setting that `≥ c` and solving:

```
n = ceil( ln(1 − c) / ln(1 − P) )
```

Edge cases:

- `P ≤ 0` — the target can't drop from this junk. No finite `n`; the junk is **excluded** from results (reported as impossible, not as a huge number).
- `P ≥ 1` — already guaranteed in one draw → `n = 1`.
- `c` must satisfy `0 < c < 1`. `c = 1` (true 100%) is unreachable; reject it.

## Per-junk match probability (without specific blessings)

A query describes a **set of acceptable outcomes**. For a single junk we need `P(match | junk)` — the probability that one junk yields *some* outcome the query accepts.

A junk's drop table is a two-level tree (groups contain equipment) with a per-equipment quality distribution and a separate per-equipment grade distribution (see `docs/domain.md`). In the DB this is flattened to `EquipmentDropRate` rows, one per (junk, group, equipment):

```
P(match | junk) =
    Σ over rows whose equipment ∈ E:
        groupDropRate                 // P(group)
      · dropRate                      // P(equipment | group)
      · P(quality ∈ Q | equipment)    // Σ of qualityKRate for k ∈ Q
      · P(grade   ∈ G | equipment)    // Σ of gradeKRate   for k ∈ G
```

where `E`, `Q`, `G` are the accepted **equipment**, **quality**, and **grade** sets from the query.

### Why the rows just sum

One junk produces exactly one (equipment, quality, grade) outcome, so the events "this row's equipment/quality/grade combination happened" are **mutually exclusive** across rows — different groups are mutually exclusive (you land in one group), and within a group different equipment are mutually exclusive (you get one item). The probability of *any* acceptable outcome is therefore the plain sum of the per-row match probabilities, with no inclusion–exclusion correction.

Note the same equipment can appear in several rows of one junk (it recurs across groups). That's fine: those rows are still mutually exclusive group paths, so summing them gives `P(get this equipment from this junk)` correctly.

### Empty sets mean "accept any"

An empty accepted-set on an axis is a wildcard, contributing a factor of `1`:

- `Q = ∅` → `P(quality ∈ Q) = 1` (any quality accepted).
- `G = ∅` → `P(grade ∈ G) = 1` (any grade accepted).
- `E = ∅` → every row of the junk is a candidate (any equipment accepted).

So a query with all three empty gives `P(match | junk) = Σ groupDropRate · dropRate ≈ 1` (the junk always drops *something*) → `n = 1`, which is correct if uninteresting.

### Quality and grade are independent

Quality (the ★ magnitude of stats) and grade (how many blessing slots are active) are **separate distributions** in the source and diverge numerically (see the parser gotchas in `docs/domain.md`). They are independent for our purposes, so `P(quality ∈ Q) · P(grade ∈ G)` is a valid product. This independence **only breaks once blessings enter** the query — see below.

## Combining across junks

The main endpoint computes `P(match | junk)` for every candidate junk, converts each to `n` via the confidence formula, drops the impossible ones (`P ≤ 0`), and returns the junks sorted ascending by `n` — fewest junk to farm first. Each junk is an independent farming choice; the tool doesn't mix junks in one answer.

## Grade number vs. active blessing slots (off-by-one)

A subtlety to keep straight before blessings are added to the calculations: the **grade number** is 1–5 (White…Red), but the number of **active blessing slots** is `grade − 1` (White grade 1 → 0 slots … Red grade 5 → 4 slots). The `EquipmentDropRate` `gradeKRate` columns are indexed by grade *number* (1–5). The `EquipmentBlessingDropRate.slot` values are 1–4. Don't conflate the two indices.

This has no effect on the current quality/grade calc, but the blessing extension below depends on it.

## Calculating for specific blessings

A query naming a blessing set `B` (a set where all members must be present) turns the plain grade factor `P(grade ∈ G)` into a grade-coupled sum, because the number of active slots — and thus whether `B` can even fit — depends on the grade:

```
grade factor(equipment) =
    Σ over g ∈ G' :  P(grade = g) · P(B all present | grade g, equipment)

    where G' = { g ∈ G : (g − 1) ≥ |B| }   // enough active slots to hold B
```

Quality stays an independent factor; only grade couples to blessings. In code this is a per-grade **presence vector** (`blessingPresenceByGrade`) multiplied into each grade's mass (`gradeFactorForRow` in `dropRateMath.ts`): grades with too few slots get presence 0, so the `G'` restriction is automatic and the no-blessing path (`B` empty ⇒ presence 1 everywhere) is unchanged.

`P(B all present | grade g)` is **not** a product of per-slot odds, because "Additional Blessings ... do not stack" — across the `g − 1` active slots the blessings are drawn **without replacement** (no piece gets the same blessing twice; see `docs/domain.md`).

**The model — a sequential chain.** Slots are rolled **in order**, slot 1 first. Each slot draws from its own published row with the blessings earlier slots already took removed, and the surviving rates renormalised:

```
P(b₁ … b_m) = Π_s  rate_s(b_s) / Σ_{x ∉ {b₁ … b_{s−1}}} rate_s(x)

P(B all present | grade g) = Σ over assignments whose blessing set ⊇ B  of  P(b₁ … b_m)
```

where `m = g − 1`. Note there is **no global normaliser**: the chain already sums to 1 over the valid assignments. Slot 1 is therefore rolled straight off its published row, untouched — nothing downstream can reach back and reweight it.

This is exactly computable — with ≤ 4 active slots over 19 blessings the enumeration has at most `19·18·17·16 ≈ 93k` terms (usually far fewer, since only nonzero rates are stored, and a branch is pruned once too few slots remain to fit what `B` still needs), trivial to sum per equipment.

### The one assumption

The source publishes a rate per `(equipment, slot, blessing)` but never says what the game does when a slot rolls a blessing the piece already carries. We assume it **rerolls that slot**. Equivalently — and identically, as a distribution — that it removes the taken blessing from the row and redistributes its weight over the survivors. Rejection-sampling one slot from `rate_s` while refusing the taken blessings *is* the renormalised row, so those two mechanics are the same model, not two models that happen to agree.

Another thought of alternative is that the game rolls every slot at once and, on any collision, throws away the whole piece and starts over. That is a genuinely different distribution: discarding the whole tuple lets a slot-3 collision retroactively change what slot 1 was, so slot 1's published row stops holding. Wizda used to compute that model. We switched because two of the three plausible mechanics collapse to the sequential chain, and only the third — restarting the whole item — gives the old numbers.

Measured across the 374 equipment with 3 active slots, for a required `{ATK, ATK%}`: the two models differ by **under 1% for the median item** and at most **~13%** at the tails, in both directions. So this is not a correctness scandal in the old code; it's a better-motivated model at a comparable price.

Because the mechanic is unpublished, any query with blessings still marks its response `estimated: true` (with a short note). Pure equipment/quality/grade queries stay exact and unflagged.

**A second-order caveat**, kept here and out of the UI: we read the published rows as the game's per-slot rate *tables* — the weights it rolls from before exclusion. The rows come from the devs' official lists and read as tables, so we treat them as absolute truth.

The tests validate that we compute *this model* exactly — a Monte-Carlo sampler of the same sequential process matches the analytic presence, and the per-blessing presences sum to the slot count as a proper distribution must — **not** that the model equals reality.

**Missing blessing data:** an equipment with drop rows but no seeded `EquipmentBlessingDropRate` rows (a data gap) gets an all-zero presence when blessings are required — we won't claim it as a source for a blessing we have no evidence it can roll — so it's omitted from blessing queries rather than treated as a wildcard.

## Validation

The pure math is checked two ways (see `dropRateMath.test.ts`):

1. **Hand-computed exact cases** pin the arithmetic (e.g. a single 100%-group, 50%-equipment fixture where `P` is a pen-and-paper product).
2. **Monte-Carlo cross-check** samples the *same* generative process the formula models — draw a group by `groupDropRate`, an equipment by `dropRate`, a quality and a grade by their distributions, many times — and asserts the closed-form `P(match | junk)` matches the empirical hit rate within a few standard errors. A separate simulation draws `n` junks and confirms the ≥1-success frequency matches the requested confidence. For blessings, a sampler rolls the slots in order, excluding what's taken, and must match `blessingPresenceByGrade`. If the closed form and the simulated process ever disagree, the formula (or our reading of the model) is wrong.
3. **A distribution invariant**: exactly `m` distinct blessings land on an `m`-slot piece, so `Σ_b P(b present) = m` by linearity of expectation. A botched renormalisation breaks this even when the hand-computed cases pass.
