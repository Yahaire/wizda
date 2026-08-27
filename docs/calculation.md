# Wizda calculations

Wizda ships two tools, and each has its own derivation. This page is the index; the math lives in [`docs/calculation/`](./calculation/).

| tool | the question | derivation |
|---|---|---|
| **Junk Oracle** | *"How much junk must I farm to guarantee item X?"* | [`calculation/junk.md`](./calculation/junk.md) |
| **Enhancement Oracle** | *"If I enhance this piece, what are the odds a blessing ends up at the number I want?"* | [`calculation/enhancement.md`](./calculation/enhancement.md) |

Both assume the game model in [`domain.md`](./domain.md). The Enhancement Oracle additionally assumes [`milestone-blessings.md`](./milestone-blessings.md) (what enhancing does to a blessing's value) and [`stones.md`](./stones.md) (what Alteration and Refinement Stones do).

## What the two share

One piece of machinery, and it is worth knowing about before reading either page: the **without-replacement blessing-slot chain**, `packages/shared/src/domain/blessingSlots.ts`.

Additional blessings don't stack, so a piece's slots are drawn without replacement — each slot draws from its own published row with the blessings earlier slots took removed and the survivors renormalised. Both tools need that same chain, for different questions:

- the Junk Oracle asks *"what are the odds this piece carries ATK **and** SUR?"*
- the Enhancement Oracle asks *"which blessing will the next milestone put in this empty slot, given what's already on the piece?"*

The chain is derived once, in [`calculation/junk.md`](./calculation/junk.md) under "Calculating for specific blessings", including the one modelling assumption it rests on. [`calculation/enhancement.md`](./calculation/enhancement.md) covers what it adds on top: pinning slots the player has reported, and drawing against the piece's *initial* blessings rather than what it currently displays.

Everything else is separate. The junk math is about drop tables and confidence; the enhancement math is about value distributions and convolution.

## Where the code lives

Both derivations are implemented as pure, Prisma-free, unit-tested modules under `packages/shared/src/domain/`:

| module | what it holds |
|---|---|
| `dropRateMath.ts` | the Junk Oracle's match probability and confidence solve |
| `enhancementMath.ts` | distributions, convolution, the derived milestone bonus, and the odds calculation |
| `blessingSlots.ts` | the shared slot chain, plus the rules for which slots a piece has filled |
| `stoneValues.ts` | Alteration and Refinement Stone ranges (static reference data) |

How those modules fit into the API — the "DB reads, the math module computes" split — is in [`architecture.md`](./architecture.md).

## A note on these paths

Doc paths are a **public interface**. They are linked from inside the app, from the About page, and from links already shared online. Add new files rather than repurposing existing paths; if a file's role has to change, leave it in place as an index or a pointer, which is exactly what this page is.
