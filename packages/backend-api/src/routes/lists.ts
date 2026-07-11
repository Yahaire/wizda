import express from 'express';

import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import {
    EquipmentJunkSource,
    EquipmentListItem,
    JunkListItem,
} from '@shared/api/endpoints/lists.models';
import { EquipmentRankKind } from '@shared/domain/rank';

import { getPrisma } from '@app/prisma';

/**
 * One (equipment, junk) drop pairing, with the highest quality/grade rank that
 * pairing reaches — i.e. the greatest 1–5 index whose per-rank rate is nonzero,
 * across every group row for the pair (mirrors the seed's `highestNonZeroRank`,
 * done in SQL so we aggregate in the DB rather than pulling every rate row).
 * `0` means "all ranks zero" (shouldn't happen) and is normalised to null.
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

  // The whole catalogue — every `Equipment` row, including pieces no junk drops
  // (they simply have empty `sources`, so the guarantee calc can't answer for
  // them and the Oracle filters them out; the list views still show them). A
  // piece's junk-droppability is thus read off `sources.length`, not a filter
  // here. `sourceMaxes` collapses the drop-rate rows to one (equipment, junk)
  // pair each, carrying the best quality/grade that pair reaches — computed in
  // the DB so we don't ship every rate row to Node just to fold it down.
  // `blessingRows` does the same for blessing reachability: the distinct codes a
  // piece can roll, deduplicated across its four slots (they always agree).
  const [equipment, sourceMaxes, blessingRows] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        rank: true,
        maxDropQuality: true,
        maxDropGrade: true,
        category: { select: { code: true, name: true } },
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
    prisma.equipmentBlessingDropRate.groupBy({
      by: ['equipmentId', 'blessingCode'],
      where: { rate: { gt: 0 } },
    }),
  ]);

  const blessingsByEquipmentId = new Map<string, string[]>();
  for (const row of blessingRows) {
    const codes = blessingsByEquipmentId.get(row.equipmentId) ?? [];
    codes.push(row.blessingCode);
    blessingsByEquipmentId.set(row.equipmentId, codes);
  }

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
    // Enriched from the Fasterthoughts taxonomy (see the seed); null for the few
    // items whose name isn't in that source.
    category: item.category ? { code: item.category.code, name: item.category.name } : null,
    rank: item.rank as EquipmentRankKind | null,
    maxDropQuality: item.maxDropQuality,
    maxDropGrade: item.maxDropGrade,
    blessings: (blessingsByEquipmentId.get(item.id) ?? []).sort(),
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
