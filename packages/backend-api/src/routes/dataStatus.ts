import express from 'express';

import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { DataStatusResponse, LanguageSyncStatus } from '@shared/api/endpoints/endpoint.models';

import { getPrisma } from '@app/prisma';

/**
 * The completion time of the last successful seed as an ISO-8601 string, or null
 * if the DB has never been seeded. Read from the `DataStatus` singleton (id = 1)
 * the seed stamps on success.
 */
export async function readDataUpdatedAt(): Promise<string | null> {
  const row = await getPrisma().dataStatus.findUnique({ where: { id: 1 } });
  return row ? row.lastSeededAt.toISOString() : null;
}

/** Every language's sync state, per `LanguageStatus` — see `seedLocalizedNames.ts`. */
async function readLanguageStatuses(): Promise<LanguageSyncStatus[]> {
  const rows = await getPrisma().languageStatus.findMany({ orderBy: { lang: 'asc' } });
  return rows.map((row) => ({
    lang: row.lang,
    isInSync: row.isInSync,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastCheckedAt: row.lastCheckedAt.toISOString(),
  }));
}

async function handleDataStatus(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  const body: DataStatusResponse = {
    dataUpdatedAt: await readDataUpdatedAt(),
    languages: await readLanguageStatuses(),
  };
  res.status(HttpStatusCode.OK).json(body);
}

export const dataStatusRouter = express.Router();

dataStatusRouter.get('/data-status', (req, res, next) => {
  handleDataStatus(req, res).catch(next);
});
