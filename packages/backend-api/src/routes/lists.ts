import express from 'express';

import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import {
    EquipmentListItem,
    JunkListItem,
} from '@shared/api/endpoints/lists.models';
import { GearTier } from '@shared/domain/tier';

import { getPrisma } from '@app/prisma';

async function handleListJunks(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  const junks = await getPrisma().junk.findMany({
    select: {
      name: true,
      hasMultiplePools: true,
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
  // omitted. `sourcePairs` fetches only the distinct (equipment, junk) pairs
  // rather than every drop-rate row.
  const [equipment, sourcePairs] = await Promise.all([
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
    prisma.equipmentDropRate.findMany({
      distinct: ['equipmentId', 'junkId'],
      select: {
        equipmentId: true,
        junk: { select: { name: true } },
      },
    }),
  ]);

  const junkNamesByEquipmentId = new Map<string, string[]>();
  for (const pair of sourcePairs) {
    const names = junkNamesByEquipmentId.get(pair.equipmentId) ?? [];
    names.push(pair.junk.name);
    junkNamesByEquipmentId.set(pair.equipmentId, names);
  }

  const body: EquipmentListItem[] = equipment.map((item) => ({
    name: item.name,
    tier: item.tier as GearTier | null,
    maxDropQuality: item.maxDropQuality,
    maxDropGrade: item.maxDropGrade,
    sources: (junkNamesByEquipmentId.get(item.id) ?? [])
      .sort((left, right) => left.localeCompare(right))
      .map((junkName) => ({ junkName })),
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
