/**
 * Gear quality — static reference data.
 *
 * Quality is shown in-game as stars (1★–5★) and scales the *magnitude* of a
 * piece's blessings (a 5★ gives larger values than a ★1 of the same blessing).
 * Like grade, it's stored as per-quality probability columns (quality1Rate…),
 * not an enum — this is a display/reference catalog for the frontend's quality
 * filter.
 */

export interface QualityInfo {
  /** Quality number = star count, 1–5. */
  value: number,
  /** Display label as repeated stars, matching the in-game display, e.g. "★★★". */
  label: string,
}

/** The five quality levels, ascending. Index + 1 = quality number. */
export const QUALITIES: readonly QualityInfo[] = [
  { value: 1, label: '★' },
  { value: 2, label: '★★' },
  { value: 3, label: '★★★' },
  { value: 4, label: '★★★★' },
  { value: 5, label: '★★★★★' },
];
