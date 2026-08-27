import {
    BLESSING_VALUE_SOURCE_CODES, BlessingValueSourceRole
} from '@shared/domain/blessingValueSources';
import { deriveBonus, ValueDistribution, verifyBonus } from '@shared/domain/enhancementMath';

import { ParsedValueRow } from './blessingValueRates.models';

/**
 * Turns `blessingValueRates.parser.ts`'s sparse rows into per-(group, source,
 * quality, blessing) distributions, then derives and verifies the **milestone
 * bonus** for every triple the `DROP` source publishes — see
 * `docs/milestone-blessings.md`, "Deriving the bonus", and
 * `@shared/domain/enhancementMath`'s `deriveBonus`/`verifyBonus`, which do the
 * actual math. No Prisma, no I/O: kept pure so it's unit-testable the same way
 * `equipmentTaxonomy.mapping.ts` is, and so `blessingValueRates.seed.ts` only
 * has to persist what this module already decided.
 */

const KEY_SEPARATOR = '|';

/** `groupCode|sourceCode|quality|blessingCode` — the axis one distribution lives on. */
function distributionKey(groupCode: string, sourceCode: string, quality: number, blessingCode: string): string {
  return [groupCode, sourceCode, quality, blessingCode].join(KEY_SEPARATOR);
}

/**
 * Builds one {@link ValueDistribution} per (group, source, quality, blessing)
 * from the parser's sparse rows (only nonzero `rate`s are stored — a `-` in
 * the source is simply an absent row). The run is filled from the lowest to
 * the highest `value` seen for that key, with an absent value in between
 * getting probability 0 (a "0%, but still possible" cell, as opposed to one
 * the source never lists at all).
 */
export function toDistributions(rows: readonly ParsedValueRow[]): Map<string, ValueDistribution> {
  const rowsByKey = new Map<string, ParsedValueRow[]>();
  for (const row of rows) {
    const key = distributionKey(row.groupCode, row.sourceCode, row.quality, row.blessingCode);
    const bucket = rowsByKey.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      rowsByKey.set(key, [row]);
    }
  }

  const distributions = new Map<string, ValueDistribution>();
  for (const [key, bucket] of rowsByKey) {
    const minValue = Math.min(...bucket.map((row) => row.value));
    const maxValue = Math.max(...bucket.map((row) => row.value));
    const probabilities = new Array<number>(maxValue - minValue + 1).fill(0);
    for (const row of bucket) {
      probabilities[row.value - minValue] = row.rate;
    }
    distributions.set(key, { minValue, probabilities });
  }
  return distributions;
}

/** One derived-and-verified (or verification-failed) milestone bonus, ready to persist. */
export interface ParsedValueBonus {
  groupCode: string;
  quality: number;
  blessingCode: string;
  minValue: number;
  probabilities: number[];
  isVerified: boolean;
  verificationNote: string | null;
}

/** A `DROP` triple that had no matching `LFAS` counterpart — `deriveBonus` had nothing to derive from. */
export interface MissingBonusSource {
  groupCode: string;
  quality: number;
  blessingCode: string;
}

export interface BuildBlessingValueBonusesResult {
  bonuses: ParsedValueBonus[];
  missingSources: MissingBonusSource[];
}

/**
 * Derives and verifies the milestone bonus for every (group, quality,
 * blessing) triple the `DROP` source has a distribution for. A triple stores
 * either way once `LFAS` is present — {@link ParsedValueBonus.isVerified}
 * false (with a note) is the degradation ladder's stated outcome, never a
 * skip, so a case-2 answer can carry a warning instead of silently losing its
 * bonus. A triple missing its `LFAS` counterpart entirely yields no bonus row
 * and is reported in {@link BuildBlessingValueBonusesResult.missingSources}
 * instead — `deriveBonus` has nothing to derive from.
 */
export function buildBlessingValueBonuses(rows: readonly ParsedValueRow[]): BuildBlessingValueBonusesResult {
  const distributions = toDistributions(rows);

  const bonuses: ParsedValueBonus[] = [];
  const missingSources: MissingBonusSource[] = [];

  for (const [key, drop] of distributions) {
    const [groupCode, sourceCode, qualityText, blessingCode] = key.split(KEY_SEPARATOR) as [string, string, string, string];
    if (sourceCode !== BLESSING_VALUE_SOURCE_CODES[BlessingValueSourceRole.DROP]) {
      continue;
    }
    const quality = Number(qualityText);

    const lesserFas = distributions.get(distributionKey(
      groupCode,
      BLESSING_VALUE_SOURCE_CODES[BlessingValueSourceRole.LESSER_FAS],
      quality,
      blessingCode,
    ));
    if (!lesserFas) {
      missingSources.push({ groupCode, quality, blessingCode });
      continue;
    }

    const bonus = deriveBonus(drop, lesserFas);
    if (!bonus) {
      bonuses.push({
        groupCode,
        quality,
        blessingCode,
        minValue: lesserFas.minValue - drop.minValue,
        probabilities: [],
        isVerified: false,
        verificationNote: 'lesserFas is narrower than drop — no added term can explain it',
      });
      continue;
    }

    const fas = distributions.get(distributionKey(
      groupCode,
      BLESSING_VALUE_SOURCE_CODES[BlessingValueSourceRole.FAS],
      quality,
      blessingCode,
    ));
    const verification = fas
      ? verifyBonus(drop, lesserFas, fas, bonus)
      : { isVerified: false as const, reason: 'no matching FAS distribution to verify against' };

    bonuses.push({
      groupCode,
      quality,
      blessingCode,
      minValue: bonus.minValue,
      probabilities: [...bonus.probabilities],
      isVerified: verification.isVerified,
      verificationNote: verification.isVerified ? null : verification.reason,
    });
  }

  return { bonuses, missingSources };
}
