import express from 'express';

import { filtersFromSignature } from '@app/popularQueries';
import { getPrisma } from '@app/prisma';
import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { PopularResult, PopularTermEntry, PopularTermKind } from '@shared/api/endpoints/popular.models';

/** How many top whole-query combos to report. */
const TOP_QUERIES_LIMIT = 20;
/** How many top items to report per axis (equipment, blessing, …). */
const TOP_TERMS_PER_KIND_LIMIT = 10;

/** One row of the per-axis top-N aggregate query below. */
interface RankedTermRow {
  kind: PopularTermKind,
  key: string,
  count: number,
}

async function handlePopular(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  const prisma = getPrisma();

  const [queries, rankedTerms] = await Promise.all([
    prisma.popularJunkOracleQuery.findMany({
      orderBy: { count: 'desc' },
      take: TOP_QUERIES_LIMIT,
      select: { signature: true, count: true },
    }),
    // Sum each term's count across every combo it appears in, then keep only
    // the top N per kind — a window function ranks within each kind so this
    // stays one query rather than one per axis.
    prisma.$queryRaw<RankedTermRow[]>`
      WITH ranked AS (
        SELECT
          t."kind" AS "kind",
          t."key" AS "key",
          SUM(q."count")::int AS "count",
          ROW_NUMBER() OVER (PARTITION BY t."kind" ORDER BY SUM(q."count") DESC) AS "rank"
        FROM "PopularJunkOracleQueryTerm" t
        JOIN "PopularJunkOracleQuery" q ON q."id" = t."queryId"
        GROUP BY t."kind", t."key"
      )
      SELECT "kind", "key", "count" FROM ranked
      WHERE "rank" <= ${TOP_TERMS_PER_KIND_LIMIT}
      ORDER BY "kind", "count" DESC
    `,
  ]);

  const terms: Record<PopularTermKind, PopularTermEntry[]> = {
    equipment: [],
    blessing: [],
    rank: [],
    category: [],
    quality: [],
    grade: [],
  };
  for (const row of rankedTerms) {
    terms[row.kind].push({ key: row.key, count: row.count });
  }

  const body: PopularResult = {
    queries: queries.map((query) => ({
      filters: filtersFromSignature(query.signature),
      count: query.count,
    })),
    terms,
  };
  res.status(HttpStatusCode.OK).json(body);
}

export const popularRouter = express.Router();

popularRouter.get('/popular', (req, res, next) => {
  handlePopular(req, res).catch(next);
});
