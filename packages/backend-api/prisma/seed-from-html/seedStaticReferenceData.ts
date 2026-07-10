import { PrismaClient } from '@local-prisma/generated/client';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_TYPES } from '@shared/domain/equipment';
import { BLESSINGS, STATS } from '@shared/domain/stats';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';

/**
 * Upserts the static reference tables from `packages/shared/src/domain` — the
 * single source of truth for these catalogs:
 *   - `Stat` (10) + `Blessing` (19)               from `stats.ts`
 *   - `EquipmentType` (7) + `EquipmentCategory` (32) from `equipment.ts`
 *   - `EquipmentRank` (7)                          from `rank.ts`
 *
 * Must run before the drop-rate seeds: `EquipmentBlessingDropRate` FKs to
 * `Blessing.code`, and the equipment-taxonomy enrichment pass FKs to
 * `EquipmentCategory.code`. `EquipmentType` is upserted before
 * `EquipmentCategory` (the FK). Small enough (~75 rows) that plain upsert loops
 * are fine — no batching needed.
 */
export async function seedStaticReferenceData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const stat of STATS) {
      await tx.stat.upsert({
        where: { kind: stat.kind },
        create: { kind: stat.kind, name: stat.name, description: stat.description },
        update: { name: stat.name, description: stat.description },
      });
    }

    for (const blessing of BLESSINGS) {
      await tx.blessing.upsert({
        where: { code: blessing.code },
        create: { code: blessing.code, statKind: blessing.statKind, isPercent: blessing.isPercent },
        update: { statKind: blessing.statKind, isPercent: blessing.isPercent },
      });
    }

    for (const type of EQUIPMENT_TYPES) {
      await tx.equipmentType.upsert({
        where: { kind: type.kind },
        create: { kind: type.kind, name: type.name },
        update: { name: type.name },
      });
    }

    for (const category of EQUIPMENT_CATEGORIES) {
      await tx.equipmentCategory.upsert({
        where: { code: category.code },
        create: {
          code: category.code,
          name: category.name,
          equipmentType: category.equipmentType,
        },
        update: { name: category.name, equipmentType: category.equipmentType },
      });
    }

    for (const rank of EQUIPMENT_RANKS) {
      await tx.equipmentRank.upsert({
        where: { kind: rank.kind },
        create: {
          kind: rank.kind,
          name: rank.name,
          orderIndex: rank.orderIndex,
          isObtainableThroughJunk: rank.isObtainableThroughJunk,
        },
        update: {
          name: rank.name,
          orderIndex: rank.orderIndex,
          isObtainableThroughJunk: rank.isObtainableThroughJunk,
        },
      });
    }
  });
}
