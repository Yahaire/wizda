/**
 * Shape of a single parsed gacha entry pulled out of the source HTML.
 * This is intentionally minimal — flesh it out once the real table structure
 * on the source pages is nailed down.
 */
export interface ParsedGachaRate {
  /** Display name of the item / weapon. */
  itemName: string;
  /** Drop/pull rate as a fraction (e.g. 0.005 for 0.5%). */
  rate: number;
  /** Which banner / pool this rate belongs to. */
  pool: string;
}
