import { FiveRankRates, ParsedJunkDropRow } from './dropRatesByJunk.models';

/**
 * Tolerance for comparing two independently-parsed drop-rate numbers that are
 * expected to represent the *same* underlying rate (just scraped off a
 * different language's copy of the same page). Much tighter than
 * `rateParsing.ts`'s `SUM_TOLERANCE` (0.005), which allows for the source's own
 * rounding when summing a *distribution* to ~100%: here we're comparing two
 * directly-parsed values that should agree to the source's full ~4-decimal
 * percent precision, so only float round-trip noise needs slack.
 */
const FINGERPRINT_TOLERANCE = 1e-6;

export interface AlignedLocalizedNames {
  aligned: true;
  /** English junk name -> localized junk name, for every junk seen. */
  junkNames: Map<string, string>;
  /** English equipment name -> localized equipment name, for every equipment seen. */
  equipmentNames: Map<string, string>;
}

export interface LocalizedNamesAlignmentFailure {
  aligned: false;
  /** Human-readable cause, naming the first divergence found — for the seed's warning log. */
  reason: string;
}

export type AlignLocalizedNamesResult = AlignedLocalizedNames | LocalizedNamesAlignmentFailure;

function ratesMatch(english: FiveRankRates, localized: FiveRankRates): boolean {
  return english.every((rate, i) => Math.abs(rate - localized[i]!) <= FINGERPRINT_TOLERANCE);
}

/**
 * Whether two rows' drop-rate numbers agree closely enough to be confident
 * they describe the same (junk, group, equipment) slot — i.e. that `localized`
 * really is the translation of `english`, not a page that has drifted out of
 * step (different game update, added/removed junk, reordered groups, ...).
 */
function fingerprintMatches(english: ParsedJunkDropRow, localized: ParsedJunkDropRow): boolean {
  return (
    english.groupNumber === localized.groupNumber
    && Math.abs(english.groupDropRate - localized.groupDropRate) <= FINGERPRINT_TOLERANCE
    && Math.abs(english.dropRate - localized.dropRate) <= FINGERPRINT_TOLERANCE
    && ratesMatch(english.qualityRates, localized.qualityRates)
    && ratesMatch(english.gradeRates, localized.gradeRates)
  );
}

/**
 * Aligns a localized language's parsed "Drop Rates by Junk" rows against the
 * English rows **by position**, proving the alignment with the
 * language-independent drop-rate numbers rather than trusting row order alone.
 *
 * Both `parseDropRatesByJunk` outputs are ordered by each junk's *first*
 * appearance in its source document, then that junk's rows in table order (see
 * `dropRatesByJunk.parser.ts`) — identical ordering logic run against a
 * structurally-mirrored page, so same-length inputs should line up index for
 * index. This function does not assume that holds; it verifies it row by row
 * and fails closed (see `LocalizedNamesAlignmentFailure`) the moment it
 * doesn't, rather than risk mis-assigning a localized name to the wrong item.
 *
 * On success, returns English -> localized name maps for every distinct junk
 * and equipment encountered. A name is expected to map consistently everywhere
 * it recurs; a single English name resolving to two different localized
 * strings is itself treated as a misalignment (not silently overwritten).
 */
export function alignLocalizedNames(
  englishRows: readonly ParsedJunkDropRow[],
  localizedRows: readonly ParsedJunkDropRow[],
): AlignLocalizedNamesResult {
  if (localizedRows.length !== englishRows.length) {
    return {
      aligned: false,
      reason: `row count mismatch: english has ${englishRows.length} row(s), `
        + `localized has ${localizedRows.length} row(s)`,
    };
  }

  const junkNames = new Map<string, string>();
  const equipmentNames = new Map<string, string>();

  for (const [index, englishRow] of englishRows.entries()) {
    const localizedRow = localizedRows[index]!;

    if (!fingerprintMatches(englishRow, localizedRow)) {
      return {
        aligned: false,
        reason: `row ${index}: drop-rate numbers differ (english junk "${englishRow.junkName}", `
          + `equipment "${englishRow.equipmentName}")`,
      };
    }

    const existingJunkName = junkNames.get(englishRow.junkName);
    if (existingJunkName !== undefined && existingJunkName !== localizedRow.junkName) {
      return {
        aligned: false,
        reason: `junk "${englishRow.junkName}" mapped to two different localized names `
          + `("${existingJunkName}" and "${localizedRow.junkName}")`,
      };
    }
    junkNames.set(englishRow.junkName, localizedRow.junkName);

    const existingEquipmentName = equipmentNames.get(englishRow.equipmentName);
    if (existingEquipmentName !== undefined && existingEquipmentName !== localizedRow.equipmentName) {
      return {
        aligned: false,
        reason: `equipment "${englishRow.equipmentName}" mapped to two different localized names `
          + `("${existingEquipmentName}" and "${localizedRow.equipmentName}")`,
      };
    }
    equipmentNames.set(englishRow.equipmentName, localizedRow.equipmentName);
  }

  return { aligned: true, junkNames, equipmentNames };
}
