import { PrismaClient } from '@local-prisma/generated/client';
import { BLESSINGS, STATS } from '@shared/domain/stats';

/**
 * Upserts the static `Stat` (10 rows) and `Blessing` (19 rows) reference
 * tables from `@shared/domain/stats.ts` — the single source of truth for the
 * stat/blessing catalog. Must run before `seedEquipmentBlessingDropRates`,
 * whose rows FK to `Blessing.code`. Small enough (~30 rows) that a plain
 * upsert loop is fine — no batching needed.
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
  });
}
