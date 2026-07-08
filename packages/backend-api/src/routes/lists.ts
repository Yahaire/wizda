import express from 'express';

import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import {
    EquipmentJunkSource,
    EquipmentListItem,
    JunkListItem,
} from '@shared/api/endpoints/lists.models';
import { GearTier } from '@shared/domain/tier';

import { getPrisma } from '@app/prisma';

/**
 * One (equipment, junk) drop pairing, with the highest quality/grade tier that
 * pairing reaches — i.e. the greatest 1–5 index whose per-tier rate is nonzero,
 * across every group row for the pair (mirrors the seed's `highestNonZeroTier`,
 * done in SQL so we aggregate in the DB rather than pulling every rate row).
 * `0` means "all tiers zero" (shouldn't happen) and is normalised to null.
 */
interface EquipmentSourceMaxRow {
  equipmentId: string,
  junkName: string,
  maxQuality: number,
  maxGrade: number,
}

async function handleListJunks(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  const junks = await getPrisma().junk.findMany({
    select: {
      name: true,
      hasMultiplePools: true,
      maxDropQuality: true,
      maxDropGrade: true,
    },
    orderBy: { name: 'asc' },
  });

  const body: JunkListItem[] = junks;
  res.status(HttpStatusCode.OK).json(body);
}

async function handleListEquipment(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  const prisma = getPrisma();

  // Only equipment with a known junk source is a meaningful filter target for
  // this tool — equipment obtainable solely via Remains/Bonus (no drop rows) is
  // omitted. `sourceMaxes` collapses the drop-rate rows to one (equipment, junk)
  // pair each, carrying the best quality/grade that pair reaches — computed in
  // the DB so we don't ship every rate row to Node just to fold it down.
  const [equipment, sourceMaxes] = await Promise.all([
    prisma.equipment.findMany({
      where: { dropRates: { some: {} } },
      select: {
        id: true,
        name: true,
        tier: true,
        maxDropQuality: true,
        maxDropGrade: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.$queryRaw<EquipmentSourceMaxRow[]>`
      SELECT
        dr."equipmentId" AS "equipmentId",
        j."name" AS "junkName",
        MAX(
          CASE
            WHEN dr."quality5Rate" > 0 THEN 5
            WHEN dr."quality4Rate" > 0 THEN 4
            WHEN dr."quality3Rate" > 0 THEN 3
            WHEN dr."quality2Rate" > 0 THEN 2
            WHEN dr."quality1Rate" > 0 THEN 1
            ELSE 0
          END
        ) AS "maxQuality",
        MAX(
          CASE
            WHEN dr."grade5Rate" > 0 THEN 5
            WHEN dr."grade4Rate" > 0 THEN 4
            WHEN dr."grade3Rate" > 0 THEN 3
            WHEN dr."grade2Rate" > 0 THEN 2
            WHEN dr."grade1Rate" > 0 THEN 1
            ELSE 0
          END
        ) AS "maxGrade"
      FROM "EquipmentDropRate" dr
      JOIN "Junk" j ON j."id" = dr."junkId"
      GROUP BY dr."equipmentId", j."name"
    `,
  ]);

  const sourcesByEquipmentId = new Map<string, EquipmentJunkSource[]>();
  for (const row of sourceMaxes) {
    const sources = sourcesByEquipmentId.get(row.equipmentId) ?? [];
    sources.push({
      junkName: row.junkName,
      maxDropQuality: row.maxQuality || null,
      maxDropGrade: row.maxGrade || null,
    });
    sourcesByEquipmentId.set(row.equipmentId, sources);
  }

  const body: EquipmentListItem[] = equipment.map((item) => ({
    name: item.name,
    // Groundwork: the item→category mapping isn't seeded yet, so this is always
    // null for now. Once `EquipmentCategory` is wired up, populate it here.
    category: null,
    tier: item.tier as GearTier | null,
    maxDropQuality: item.maxDropQuality,
    maxDropGrade: item.maxDropGrade,
    sources: (sourcesByEquipmentId.get(item.id) ?? [])
      .sort((left, right) => left.junkName.localeCompare(right.junkName)),
  }));
  res.status(HttpStatusCode.OK).json(body);
}

export const listsRouter = express.Router();

listsRouter.get('/junks', (req, res, next) => {
  handleListJunks(req, res).catch(next);
});

listsRouter.get('/equipment', (req, res, next) => {
  handleListEquipment(req, res).catch(next);
});
