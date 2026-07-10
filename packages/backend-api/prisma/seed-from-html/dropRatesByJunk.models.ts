/** 1★-5★ quality drop rates, or grade 1-5 drop rates, as fractions in [0, 1]. */
export type FiveRankRates = [number, number, number, number, number];

/**
 * One row of the "Drop Rates by Junk" table: a single (junk, group, equipment)
 * combination with its quality and grade distributions.
 */
export interface ParsedJunkDropRow {
  junkName: string;
  groupNumber: number;
  /** P(group), as a fraction in [0, 1]. Repeats across every row of the same group. */
  groupDropRate: number;
  equipmentName: string;
  /** P(equipment | group), as a fraction in [0, 1]. */
  dropRate: number;
  qualityRates: FiveRankRates;
  gradeRates: FiveRankRates;
}
