import { PrismaClient } from '@local-prisma/generated/client';

import { ParseEquipmentBlessingDropRatesResult } from './equipmentBlessingDropRate.parser';
import { upsertNamesGetIds } from './seedUtils';

/**
 * Persists parsed "Additional Blessing Drop Rates by Equipment" rows: upserts
 * `Equipment` by name (creating any not already seeded by the junk pass),
 * then wipes and rebuilds `EquipmentBlessingDropRate` in full (TRUNCATE +
 * reinsert, matching its documented full-snapshot-per-scrape semantics).
 *
 * Batched from the start (createMany, not per-row) — this table is likely
 * larger than the junk drop-rate one (~100k+ rows by rough estimate), and a
 * row-by-row loop already blew the junk seed's transaction timeout once.
 */
export async function seedEquipmentBlessingDropRates(
  prisma: PrismaClient,
  { rows }: ParseEquipmentBlessingDropRatesResult,
): Promise<void> {
  const equipmentNames = [...new Set(rows.map((row) => row.equipmentName))];

  await prisma.$transaction(async (tx) => {
    const equipmentIdByName = await upsertNamesGetIds(
      equipmentNames,
      (names) => tx.equipment.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }),
      (names) => tx.equipment.createMany({ data: names.map((name) => ({ name })) }),
    );

    await tx.equipmentBlessingDropRate.deleteMany();
    await tx.equipmentBlessingDropRate.createMany({
      data: rows.map((row) => ({
        equipmentId: equipmentIdByName.get(row.equipmentName)!,
        slot: row.slot,
        blessingCode: row.blessingCode,
        rate: row.rate,
      })),
    });
  }, { timeout: 120_000 });
}
