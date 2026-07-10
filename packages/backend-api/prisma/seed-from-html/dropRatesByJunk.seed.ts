import { Prisma, PrismaClient } from '@local-prisma/generated/client';

import { FiveRankRates } from './dropRatesByJunk.models';
import { ParseDropRatesByJunkResult } from './dropRatesByJunk.parser';
import { upsertNamesGetIds } from './seedUtils';

/** Highest 1-based rank index (★ or grade) with a nonzero rate, or undefined if all zero. */
function highestNonZeroRank(rates: FiveRankRates): number | undefined {
  let highest: number | undefined;
  rates.forEach((rate, index) => {
    if (rate > 0) {
      highest = index + 1;
    }
  });
  return highest;
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
    const maxQualityByJunk = new Map<string, number>();
    const maxGradeByJunk = new Map<string, number>();
    const accumulate = (map: Map<string, number>, key: string, value: number | undefined) => {
      if (value !== undefined) {
        map.set(key, Math.max(value, map.get(key) ?? 0));
      }
    };
    for (const row of rows) {
      const maxQuality = highestNonZeroRank(row.qualityRates);
      const maxGrade = highestNonZeroRank(row.gradeRates);
      accumulate(maxQualityByEquipment, row.equipmentName, maxQuality);
      accumulate(maxGradeByEquipment, row.equipmentName, maxGrade);
      accumulate(maxQualityByJunk, row.junkName, maxQuality);
      accumulate(maxGradeByJunk, row.junkName, maxGrade);
    }

    const equipmentUpdateValues = [...equipmentIdByName].map(([name, id]) => Prisma.sql`(
      ${id}::text, ${maxQualityByEquipment.get(name) ?? null}::int, ${maxGradeByEquipment.get(name) ?? null}::int
    )`);
    if (equipmentUpdateValues.length > 0) {
      await tx.$executeRaw`
        UPDATE "Equipment" AS e
        SET "maxDropQuality" = v.quality, "maxDropGrade" = v.grade
        FROM (VALUES ${Prisma.join(equipmentUpdateValues)}) AS v(id, quality, grade)
        WHERE e.id = v.id
      `;
    }

    const junkUpdateValues = [...junkIdByName].map(([name, id]) => Prisma.sql`(
      ${id}::text, ${maxQualityByJunk.get(name) ?? null}::int, ${maxGradeByJunk.get(name) ?? null}::int
    )`);
    if (junkUpdateValues.length > 0) {
      await tx.$executeRaw`
        UPDATE "Junk" AS j
        SET "maxDropQuality" = v.quality, "maxDropGrade" = v.grade
        FROM (VALUES ${Prisma.join(junkUpdateValues)}) AS v(id, quality, grade)
        WHERE j.id = v.id
      `;
    }
  }, { timeout: 60_000 });
}
