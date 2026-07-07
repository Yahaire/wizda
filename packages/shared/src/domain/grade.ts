/**
 * Gear grade — static reference data.
 *
 * Grade is shown in-game as a color (White…Red) and dictates how many blessing
 * slots are active. NOTE the off-by-one: the grade *number* is 1–5, but the
 * number of active blessing slots is number − 1 (White 0 … Red 4). See
 * docs/domain.md and docs/calculation.md.
 *
 * Grade is stored in the DB as per-grade probability columns (grade1Rate…), not
 * as an enum, so there's no Prisma mirror — this is a display/reference catalog
 * for the frontend's grade filter (and a home for the color names).
 */

export interface GradeInfo {
  /** Grade number, 1–5. */
  value: number,
  /** In-game color name, White…Red. */
  name: string,
  /** Active blessing slots this grade unlocks = value − 1 (White 0 … Red 4). */
  activeBlessingSlots: number,
}

/** The five grades, ascending. Index + 1 = grade number. */
export const GRADES: readonly GradeInfo[] = [
  {
    value: 1,
    name: 'White',
    activeBlessingSlots: 0,
  },
  {
    value: 2,
    name: 'Green',
    activeBlessingSlots: 1,
  },
  {
    value: 3,
    name: 'Blue',
    activeBlessingSlots: 2,
  },
  {
    value: 4,
    name: 'Purple',
    activeBlessingSlots: 3,
  },
  {
    value: 5,
    name: 'Red',
    activeBlessingSlots: 4,
  },
];
