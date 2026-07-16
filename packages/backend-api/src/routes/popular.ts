import express from 'express';

import { filtersFromSignature } from '@app/popularQueries';
import { getPrisma } from '@app/prisma';
import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { PopularResult, PopularTermKind } from '@shared/api/endpoints/popular.models';

/** How many top whole-query combos to report. */
const TOP_QUERIES_LIMIT = 20;
/** How many top items to report per axis (equipment, blessing, …). */
const TOP_TERMS_PER_KIND_LIMIT = 10;

/** One row of the per-axis top-N aggregate query below. */
interface RankedTermRow {
  kind: PopularTermKind,
  key: string,
}

async function handlePopular(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  const prisma = getPrisma();

  const [queries, rankedTerms] = await Promise.all([
    // `count` still ranks the rows, but isn't selected — it never leaves the DB.
    //
    // `signature` breaks ties. Without it the order among equally-searched combos is
    // whatever the plan happens to emit, which drifts between runs — and since the
    // count no longer ships, a caller can't tell a real ranking from a coin toss.
    // It also keeps the client's top-N slice from reshuffling on every page load.
    prisma.popularJunkOracleQuery.findMany({
      orderBy: [
        { count: 'desc' },
        { signature: 'asc' },
      ],
      take: TOP_QUERIES_LIMIT,
      select: { signature: true },
    }),
    // Sum each term's count across every combo it appears in, then keep only
    // the top N per kind — a window function ranks within each kind so this
    // stays one query rather than one per axis.
    //
    // The sum both ranks and orders the rows, but stays inside the CTE: the outer
    // SELECT can still ORDER BY a column it doesn't project, so the tally never
    // reaches the response (see `PopularResult.terms`).
    //
    // `key` breaks ties in both the window and the final sort — equally-searched
    // terms are common (every term of a single popular combo shares its count), and
    // without a tiebreak both which ones survive the top-N cut and what order they
    // arrive in drift between runs.
    prisma.$queryRaw<RankedTermRow[]>`
      WITH ranked AS (
        SELECT
          t."kind" AS "kind",
          t."key" AS "key",
          SUM(q."count")::int AS "count",
          ROW_NUMBER() OVER (
            PARTITION BY t."kind"
            ORDER BY SUM(q."count") DESC, t."key" ASC
          ) AS "rank"
        FROM "PopularJunkOracleQueryTerm" t
        JOIN "PopularJunkOracleQuery" q ON q."id" = t."queryId"
        GROUP BY t."kind", t."key"
      )
      SELECT "kind", "key" FROM ranked
      WHERE "rank" <= ${TOP_TERMS_PER_KIND_LIMIT}
      ORDER BY "kind", "count" DESC, "key" ASC
    `,
  ]);

  // The query already returns each kind's rows most-searched first, so appending in
  // order is what puts them in order.
  const terms: Record<PopularTermKind, string[]> = {
    equipment: [],
    blessing: [],
    rank: [],
    category: [],
    quality: [],
    grade: [],
  };
  for (const row of rankedTerms) {
    terms[row.kind].push(row.key);
  }

  // `count` orders the rows but never ships: search volume is ours to see, not the
  // player's (see `PopularQueryEntry`).
  const body: PopularResult = {
    queries: queries.map((query) => ({
      filters: filtersFromSignature(query.signature),
    })),
    terms,
  };
  res.status(HttpStatusCode.OK).json(body);
}

export const popularRouter = express.Router();

popularRouter.get('/popular', (req, res, next) => {
  handlePopular(req, res).catch(next);
});
