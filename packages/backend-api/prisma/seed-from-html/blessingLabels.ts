import { getBlessingCode, StatKind } from '@shared/domain/stats';

/** Matches a source label like "ATK Increase (%)" or "SUR Increase (fixed)". */
const LABEL_PATTERN = /^(.+) Increase \((%|fixed)\)$/;
const STAT_LABELS = Object.values(StatKind) as string[];

/**
 * Parses a source blessing label — "<Stat> Increase (%)" or "<Stat> Increase
 * (fixed)" — into our blessing code. The source uses this exact grammar in two
 * places: as a `<th>` in "Additional Blessing Drop Rates by Equipment"
 * (`equipmentBlessingDropRate.parser.ts`) and as the first `<td>` of each row
 * in the value tables (`blessingValueRates.parser.ts`) — extracted here rather
 * than duplicated. Returns `null` for anything that doesn't match, rather than
 * throwing: an unrecognised label is drift for the caller to record, not a
 * structural failure.
 */
export function parseBlessingLabel(text: string): string | null {
  const match = LABEL_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }

  const label = match[1]!;
  const variant = match[2]!;
  if (!STAT_LABELS.includes(label)) {
    return null;
  }

  return getBlessingCode(label as StatKind, variant === '%');
}
