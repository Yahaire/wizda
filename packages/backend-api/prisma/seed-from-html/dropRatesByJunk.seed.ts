import { Prisma, PrismaClient } from '@local-prisma/generated/client';

import { FiveTierRates } from './dropRatesByJunk.models';
import { ParseDropRatesByJunkResult } from './dropRatesByJunk.parser';

/** Highest 1-based tier index (★ or grade) with a nonzero rate, or undefined if all zero. */
function highestNonZeroTier(rates: FiveTierRates): number | undefined {
  let highest: number | undefined;
  rates.forEach((rate, index) => {
    if (rate > 0) {
      highest = index + 1;
    }
  });
  return highest;
}

/** Upserts rows identified by `name` in bulk: one findMany, then one createMany for whatever's missing. */
async function upsertNamesGetIds(
  names: string[],
  findExisting: (names: string[]) => Promise<{ id: string; name: string }[]>,
  createMissing: (names: string[]) => Promise<unknown>,
): Promise<Map<string, string>> {
  const existing = await findExisting(names);
  const idByName = new Map(existing.map((row) => [row.name, row.id]));

  const missingNames = names.filter((name) => !idByName.has(name));
  if (missingNames.length > 0) {
    await createMissing(missingNames);
    const created = await findExisting(missingNames);
    for (const row of created) {
      idByName.set(row.name, row.id);
    }
  }

  return idByName;
}

/**
 * Persists parsed "Drop Rates by Junk" rows: upserts `Junk` and `Equipment` by
 * name (setting `Junk.hasMultiplePools` per `junksWithMultiplePools` — see
 * `parseDropRatesByJunk`), then wipes and rebuilds `EquipmentDropRate` in full
 * (it has no unique constraint — the source is a full snapshot every scrape,
 * not an incremental feed — see schema.prisma), and derives each equipment's
 * `maxDropQuality` / `maxDropGrade` from the rates just parsed.
 *
 * Everything is batched (createMany / updateMany / one raw bulk UPDATE)
 * rather than looping row-by-row: the real page has ~700 junks and ~3000
 * equipment, and one round trip per row blows well past the default
 * interactive-transaction timeout.
 */
export async function seedDropRatesByJunk(
  prisma: PrismaClient,
  { rows, junksWithMultiplePools }: ParseDropRatesByJunkResult,
): Promise<void> {
  const junkNames = [...new Set(rows.map((row) => row.junkName))];
  const equipmentNames = [...new Set(rows.map((row) => row.equipmentName))];

  await prisma.$transaction(async (tx) => {
    const junkIdByName = await upsertNamesGetIds(
      junkNames,
      (names) => tx.junk.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
      (names) => tx.junk.createMany({
        data: names.map((name) => ({ name, hasMultiplePools: junksWithMultiplePools.has(name) })),
      }),
    );

    const junksNeedingFlagTrue = junkNames.filter((name) => junksWithMultiplePools.has(name));
    const junksNeedingFlagFalse = junkNames.filter((name) => !junksWithMultiplePools.has(name));
    if (junksNeedingFlagTrue.length > 0) {
      await tx.junk.updateMany({ where: { name: { in: junksNeedingFlagTrue } }, data: { hasMultiplePools: true } });
    }
    if (junksNeedingFlagFalse.length > 0) {
      await tx.junk.updateMany({ where: { name: { in: junksNeedingFlagFalse } }, data: { hasMultiplePools: false } });
    }

    const equipmentIdByName = await upsertNamesGetIds(
      equipmentNames,
      (names) => tx.equipment.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
      (names) => tx.equipment.createMany({ data: names.map((name) => ({ name })) }),
    );

    await tx.equipmentDropRate.deleteMany();
    await tx.equipmentDropRate.createMany({
      data: rows.map((row) => ({
        junkId: junkIdByName.get(row.junkName)!,
        equipmentId: equipmentIdByName.get(row.equipmentName)!,
        groupDropRate: row.groupDropRate,
        dropRate: row.dropRate,
        groupNumber: row.groupNumber,
        quality1Rate: row.qualityRates[0],
        quality2Rate: row.qualityRates[1],
        quality3Rate: row.qualityRates[2],
        quality4Rate: row.qualityRates[3],
        quality5Rate: row.qualityRates[4],
        grade1Rate: row.gradeRates[0],
        grade2Rate: row.gradeRates[1],
        grade3Rate: row.gradeRates[2],
        grade4Rate: row.gradeRates[3],
        grade5Rate: row.gradeRates[4],
      })),
    });

    const maxQualityByEquipment = new Map<string, number>();
    const maxGradeByEquipment = new Map<string, number>();
    for (const row of rows) {
      const maxQuality = highestNonZeroTier(row.qualityRates);
      if (maxQuality !== undefined) {
        maxQualityByEquipment.set(
          row.equipmentName,
          Math.max(maxQuality, maxQualityByEquipment.get(row.equipmentName) ?? 0),
        );
      }

      const maxGrade = highestNonZeroTier(row.gradeRates);
      if (maxGrade !== undefined) {
        maxGradeByEquipment.set(
          row.equipmentName,
          Math.max(maxGrade, maxGradeByEquipment.get(row.equipmentName) ?? 0),
        );
      }
    }

    const updateValues = [...equipmentIdByName].map(([name, id]) => Prisma.sql`(
      ${id}::text, ${maxQualityByEquipment.get(name) ?? null}::int, ${maxGradeByEquipment.get(name) ?? null}::int
    )`);
    if (updateValues.length > 0) {
      await tx.$executeRaw`
        UPDATE "Equipment" AS e
        SET "maxDropQuality" = v.quality, "maxDropGrade" = v.grade
        FROM (VALUES ${Prisma.join(updateValues)}) AS v(id, quality, grade)
        WHERE e.id = v.id
      `;
    }
  }, { timeout: 60_000 });
}
