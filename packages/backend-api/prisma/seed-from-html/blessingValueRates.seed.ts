import {
    BlessingValueSelectorKind as PrismaBlessingValueSelectorKind, Prisma, PrismaClient
} from '@local-prisma/generated/client';

import { ParsedValueBonus } from './blessingValueBonuses';
import { ParsedValueGroup, ParsedValueRow, ParsedValueSource } from './blessingValueRates.models';

export interface BlessingValueRatesSeedInput {
  sources: readonly ParsedValueSource[];
  groups: readonly ParsedValueGroup[];
  rows: readonly ParsedValueRow[];
  bonuses: readonly ParsedValueBonus[];
  /** Equipment id -> the `BlessingValueGroup.code` it rolls on, from `assignValueGroups`. */
  groupCodeById: ReadonlyMap<string, string>;
}

/** Outcome of the seed pass — surfaced by the orchestrator for logging. */
export interface SeedBlessingValuesResult {
  sources: number;
  groups: number;
  rates: number;
  bonuses: number;
  unverifiedBonuses: number;
  equipmentAssigned: number;
}

/**
 * Persists the parsed "value" tables (what number a blessing lands on) plus
 * the derived milestone bonuses, and links every ranked `Equipment` to the
 * `BlessingValueGroup` it rolls on. Wipe-and-rebuild, like every other
 * snapshot table in this folder (TRUNCATE-equivalent + reinsert) — this
 * scrape is a full snapshot every run, not an incremental feed.
 *
 * **Never a per-row loop.** `equipmentBlessingDropRate.seed.ts` already blew
 * the transaction timeout doing that once; this pass batches every write
 * (`createMany` for the four tables, one bulk `UPDATE ... FROM (VALUES ...)`
 * for the equipment linkage, mirroring `equipmentTaxonomy.seed.ts`).
 *
 * Delete order matters (children before parents, and `Equipment`'s FK
 * released before `BlessingValueGroup` is wiped); recreate order is the
 * reverse (parents before children).
 */
export async function seedBlessingValueRates(
  prisma: PrismaClient,
  { sources, groups, rows, bonuses, groupCodeById }: BlessingValueRatesSeedInput,
): Promise<SeedBlessingValuesResult> {
  await prisma.$transaction(async (tx) => {
    // Release Equipment's FK before BlessingValueGroup is wiped below.
    await tx.equipment.updateMany({
      where: { blessingValueGroupCode: { not: null } },
      data: { blessingValueGroupCode: null },
    });

    await tx.blessingValueRate.deleteMany();
    await tx.blessingValueBonus.deleteMany();
    await tx.blessingValueGroup.deleteMany();
    await tx.blessingValueSource.deleteMany();

    await tx.blessingValueSource.createMany({
      data: sources.map((source) => ({
        code: source.code,
        label: source.label,
        orderIndex: source.orderIndex,
      })),
    });

    await tx.blessingValueGroup.createMany({
      data: groups.map((group) => ({
        code: group.selector.code,
        label: group.selector.label,
        orderIndex: group.orderIndex,
        rankOrderMin: group.selector.rankOrderMin,
        rankOrderMax: group.selector.rankOrderMax,
        // Our local `BlessingValueSelectorKind` (blessingValueRates.models.ts) and
        // the Prisma-generated enum share the same member names 1:1 by design —
        // the schema doc-comment says so explicitly. A plain cast is safe here.
        selectorKind: group.selector.kind as unknown as PrismaBlessingValueSelectorKind,
        selectorTokens: [...group.selector.tokens],
      })),
    });

    await tx.blessingValueRate.createMany({
      data: rows.map((row) => ({
        groupCode: row.groupCode,
        sourceCode: row.sourceCode,
        quality: row.quality,
        blessingCode: row.blessingCode,
        value: row.value,
        rate: row.rate,
      })),
    });

    await tx.blessingValueBonus.createMany({
      data: bonuses.map((bonus) => ({
        groupCode: bonus.groupCode,
        quality: bonus.quality,
        blessingCode: bonus.blessingCode,
        minValue: bonus.minValue,
        probabilities: bonus.probabilities,
        isVerified: bonus.isVerified,
        verificationNote: bonus.verificationNote,
      })),
    });

    if (groupCodeById.size > 0) {
      const values = [...groupCodeById].map(([equipmentId, groupCode]) => Prisma.sql`(
        ${equipmentId}::text, ${groupCode}::text
      )`);
      await tx.$executeRaw`
        UPDATE "Equipment" AS e
        SET "blessingValueGroupCode" = v.group_code
        FROM (VALUES ${Prisma.join(values)}) AS v(id, group_code)
        WHERE e.id = v.id
      `;
    }
  }, { timeout: 120_000 });

  return {
    sources: sources.length,
    groups: groups.length,
    rates: rows.length,
    bonuses: bonuses.length,
    unverifiedBonuses: bonuses.filter((bonus) => !bonus.isVerified).length,
    equipmentAssigned: groupCodeById.size,
  };
}
