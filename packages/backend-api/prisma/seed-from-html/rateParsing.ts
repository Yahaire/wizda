/** Fraction sums are allowed to drift this much from 1 before we warn (source rounding). */
export const SUM_TOLERANCE = 0.005;

/** Parses a source rate cell: `"-"` means 0, else strips the trailing `%` and converts to a fraction. */
export function parsePercent(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '-') {
    return 0;
  }
  return parseFloat(trimmed.replace('%', '')) / 100;
}

export function isCloseToOne(sum: number): boolean {
  return Math.abs(sum - 1) <= SUM_TOLERANCE;
}
