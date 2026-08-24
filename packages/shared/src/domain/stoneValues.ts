/**
 * Alteration & Refinement Stone values — static reference data.
 *
 * The value a blessing takes when an **Alteration Stone** (replaces the
 * blessing's attribute and value) or a **Refinement Stone** (adds value on top)
 * is applied. Both stone types draw from the *same* ranges, which is why this
 * module is named for stones generally rather than for either one.
 *
 * The distribution is **uniform over the range** — that part is official, worded
 * identically on both source pages: "all values applied are selected with equal
 * probability". The ranges themselves are published nowhere official (each
 * stone simply states its own range in its item name); ours were confirmed in
 * game, cell by cell, on 2026-08-23. See docs/stones.md.
 *
 * Like `grade.ts` and `quality.ts`, this is reference data the math reads
 * directly — there is no Prisma mirror and the seed never touches it.
 */

import { BLESSINGS, StatKind } from './stats';

/**
 * The four bands stone values are grouped into. Note this is **not** the same
 * grouping the drop tables use: there ASPD and SUR have different ranges, while
 * here they share one. That difference is real, not a transcription slip — see
 * docs/stones.md.
 */
export enum StoneBlessingGroupKind {
  FLAT = 'FLAT',
  PERCENT = 'PERCENT',
  ASPD_SUR = 'ASPD_SUR',
  ASPD_PERCENT = 'ASPD_PERCENT',
}

/** An inclusive integer range of possible values, drawn uniformly. */
export interface StoneValueRange {
  minValue: number,
  maxValue: number,
}

export interface StoneBlessingGroupInfo {
  kind: StoneBlessingGroupKind,
  /** Display name, matching how the range tables label the band. */
  name: string,
  /**
   * The range per stone ★, at indices 0..4 for ★1..★5. NOTE the ★ is the
   * *stone's*, not the equipment's: extraction can yield a stone up to two
   * tiers above the piece it came from, so this is a player input rather than
   * something derivable from the gear.
   */
  rangesByStoneQuality: readonly StoneValueRange[],
}

/** The four value bands. Confirmed in game 2026-08-23; see docs/stones.md. */
export const STONE_BLESSING_GROUPS: readonly StoneBlessingGroupInfo[] = [
  {
    kind: StoneBlessingGroupKind.FLAT,
    name: 'Flat',
    rangesByStoneQuality: [
      { minValue: 1, maxValue: 3 },
      { minValue: 2, maxValue: 4 },
      { minValue: 3, maxValue: 5 },
      { minValue: 4, maxValue: 6 },
      { minValue: 5, maxValue: 7 },
    ],
  },
  {
    kind: StoneBlessingGroupKind.PERCENT,
    name: 'Percent (%)',
    rangesByStoneQuality: [
      { minValue: 1, maxValue: 2 },
      { minValue: 1, maxValue: 3 },
      { minValue: 2, maxValue: 4 },
      { minValue: 3, maxValue: 5 },
      { minValue: 4, maxValue: 6 },
    ],
  },
  {
    kind: StoneBlessingGroupKind.ASPD_SUR,
    name: 'ASPD, SUR',
    rangesByStoneQuality: [
      { minValue: 1, maxValue: 2 },
      { minValue: 2, maxValue: 3 },
      { minValue: 3, maxValue: 4 },
      { minValue: 3, maxValue: 5 },
      { minValue: 4, maxValue: 6 },
    ],
  },
  {
    kind: StoneBlessingGroupKind.ASPD_PERCENT,
    name: 'ASPD%',
    rangesByStoneQuality: [
      { minValue: 1, maxValue: 2 },
      { minValue: 1, maxValue: 3 },
      { minValue: 2, maxValue: 4 },
      { minValue: 3, maxValue: 5 },
      { minValue: 3, maxValue: 6 },
    ],
  },
];

const GROUP_BY_KIND = new Map<StoneBlessingGroupKind, StoneBlessingGroupInfo>(
  STONE_BLESSING_GROUPS.map((group) => [group.kind, group]),
);

/**
 * Which band a blessing's stone value is drawn from. Derived from
 * {@link BLESSINGS} rather than hand-listed, the same way `BLESSINGS` is itself
 * derived from `STATS` — so a blessing added upstream can't silently go
 * ungrouped (the sibling test asserts the partition stays exact and total).
 *
 * Edge cases: an unrecognised blessing code returns `null` rather than throwing;
 * SUR has no percent variant, so it only ever lands in `ASPD_SUR`.
 */
export function getStoneBlessingGroup(blessingCode: string): StoneBlessingGroupKind | null {
  const blessing = BLESSINGS.find((candidate) => candidate.code === blessingCode);
  if (!blessing) {
    return null;
  }

  if (blessing.statKind === StatKind.SUR) {
    return StoneBlessingGroupKind.ASPD_SUR;
  }
  if (blessing.statKind === StatKind.ASPD) {
    return blessing.isPercent ? StoneBlessingGroupKind.ASPD_PERCENT : StoneBlessingGroupKind.ASPD_SUR;
  }
  return blessing.isPercent ? StoneBlessingGroupKind.PERCENT : StoneBlessingGroupKind.FLAT;
}

/**
 * The range a stone of `stoneQuality` (★1–★5) gives for `blessingCode`.
 *
 * Edge cases: returns `null` for an unrecognised blessing code or a star rating
 * outside 1–5, rather than throwing — the caller decides whether that's a
 * validation error or a "no data" answer.
 */
export function getStoneValueRange(
  blessingCode: string,
  stoneQuality: number,
): StoneValueRange | null {
  const kind = getStoneBlessingGroup(blessingCode);
  if (!kind) {
    return null;
  }

  const group = GROUP_BY_KIND.get(kind);
  return group?.rangesByStoneQuality[stoneQuality - 1] ?? null;
}
