# Wizda documentation

Wizda tells *Wizardry Variants Daphne* players how much farming — or how much luck — a specific piece of gear will cost them. These are the working notes behind that: what the game does, what our data says, and why the code is shaped the way it is.

Everything here is written to be read by a person who wasn't in the room. Where a number came from in-game rather than from a published table, the doc says so.

## Start here

| If you want to know… | Read |
|---|---|
| what the game's items, ranks, grades and blessings actually are | [`domain.md`](./domain.md) |
| how the code is layered, and what runs where | [`architecture.md`](./architecture.md) |
| the math behind either tool's answer | [`calculation.md`](./calculation.md) — an index to the two derivations |

## The game model

What the game does, independent of our code. Read `domain.md` first; these three assume it.

| doc | covers |
|---|---|
| [`domain.md`](./domain.md) | rank, quality, grade, blessings, the drop tables, and the data model built from them |
| [`milestone-blessings.md`](./milestone-blessings.md) | what enhancing to +5/+10/+15/+20 does to a blessing's value, and where every number behind it came from |
| [`stones.md`](./stones.md) | Alteration, Refinement, and the two Full Alteration Stones |
| [`glossary.md`](./glossary.md) | agreed EN/JA wording for in-game terms |

## The derivations

| doc | answers |
|---|---|
| [`calculation.md`](./calculation.md) | the index, and the one piece of machinery both tools share |
| [`calculation/junk.md`](./calculation/junk.md) | *"How much junk must I farm to guarantee item X?"* |
| [`calculation/enhancement.md`](./calculation/enhancement.md) | *"If I enhance this piece, what are the odds a blessing ends up at the number I want?"* |

## How the app works

| doc | covers |
|---|---|
| [`architecture.md`](./architecture.md) | the three-package split, and why the DB stores while the math module computes |
| [`i18n.md`](./i18n.md) | how a page ends up in English or Japanese — the URL path is the source of truth |
| [`search.md`](./search.md) | how a query finds an item, including the Japanese reading pass |
| [`sharing.md`](./sharing.md) | shareable links, Oracle URL state, and the share-card image |
| [`analytics.md`](./analytics.md) | what we measure, and what we deliberately don't |
| [`wizda-voice.md`](./wizda-voice.md) | how the mascot speaks |

## A note on these paths

**Doc paths are a public interface.** They're linked from inside the app, from the About page, and from links already shared online. Add new files rather than repurposing existing ones; if a file's role has to change, leave it in place as an index or a pointer.

That is why [`calculation.md`](./calculation.md) is an index rather than a redirect — it was the Junk Oracle's derivation until a second tool needed one of its own, and its URL had already escaped.
