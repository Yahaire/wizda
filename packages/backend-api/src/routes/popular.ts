import express from 'express';

import { filtersFromSignature, POPULAR_WINDOW_DAYS, utcDayStart } from '@app/popularQueries';
import { getPrisma } from '@app/prisma';
import { Prisma } from '@local-prisma/generated/client';
import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { PopularPeriod, PopularResult, PopularTermKind } from '@shared/api/endpoints/popular.models';

/** How many top whole-query combos to report. */
const TOP_QUERIES_LIMIT = 20;
/** How many top items to report per axis (equipment, blessing, …). */
const TOP_TERMS_PER_KIND_LIMIT = 10;
/**
 * The fewest searches the recent window must hold before it ranks anything.
 * Under this, the all-time counts rank instead: a near-empty window — the first
 * days after the per-day counts started, or a quiet month — would otherwise
 * offer a list ranked on ones and twos, reshuffled by every single search. At
 * ~30 searches a day this is a few days of filling, not weeks.
 */
const MIN_RECENT_SEARCHES = 100;

/** One row of the per-axis top-N aggregate query below. */
interface RankedTermRow {
  kind: PopularTermKind,
  key: string,
}

/**
 * The tally each period ranks by, as a CTE body: one row per combo, its `id`
 * and its `count`. The recent period sums the per-day buckets inside the
 * window; all-time reads the lifetime count off the combo itself. Everything
 * downstream is written once against this shape.
 */
function tallySql(period: PopularPeriod): Prisma.Sql {
  if (period === 'allTime') {
    return Prisma.sql`SELECT "id", "count" FROM "PopularJunkOracleQuery"`;
  }
  return Prisma.sql`
    SELECT "queryId" AS "id", SUM("count")::int AS "count"
    FROM "PopularJunkOracleQueryDay"
    WHERE "day" >= ${utcDayStart(POPULAR_WINDOW_DAYS)}
    GROUP BY "queryId"
  `;
}

/**
 * Only combos with a *subject* — something they're a search *for* — make the
 * list (see `PopularResult.queries`). The subject axes mirror what the client's
 * `subjectOf` draws on: equipment first, else category and/or rank.
 */
const SUBJECT_KINDS = Prisma.join(['equipment', 'category', 'rank']);

async function rankedQueries(period: PopularPeriod): Promise<{ signature: string }[]> {
  // `count` ranks the rows but isn't selected — it never leaves the DB.
  //
  // `signature` breaks ties. Without it the order among equally-searched combos is
  // whatever the plan happens to emit, which drifts between runs — and since the
  // count doesn't ship, a caller can't tell a real ranking from a coin toss. It
  // also keeps the client's top-N slice from reshuffling on every page load.
  return getPrisma().$queryRaw<{ signature: string }[]>`
    WITH tally AS (${tallySql(period)})
    SELECT q."signature"
    FROM tally
    JOIN "PopularJunkOracleQuery" q ON q."id" = tally."id"
    WHERE EXISTS (
      SELECT 1 FROM "PopularJunkOracleQueryTerm" t
      WHERE t."queryId" = q."id" AND t."kind" IN (${SUBJECT_KINDS})
    )
    ORDER BY tally."count" DESC, q."signature" ASC
    LIMIT ${TOP_QUERIES_LIMIT}
  `;
}

async function rankedTerms(period: PopularPeriod): Promise<RankedTermRow[]> {
  // Sum each term's count across every combo it appears in, then keep only the
  // top N per kind — a window function ranks within each kind so this stays one
  // query rather than one per axis.
  //
  // The sum both ranks and orders the rows, but stays inside the CTE: the outer
  // SELECT can still ORDER BY a column it doesn't project, so the tally never
  // reaches the response (see `PopularResult.terms`).
  //
  // `key` breaks ties in both the window and the final sort — equally-searched
  // terms are common (every term of a single popular combo shares its count), and
  // without a tiebreak both which ones survive the top-N cut and what order they
  // arrive in drift between runs.
  return getPrisma().$queryRaw<RankedTermRow[]>`
    WITH tally AS (${tallySql(period)}),
    ranked AS (
      SELECT
        t."kind" AS "kind",
        t."key" AS "key",
        SUM(tally."count")::int AS "count",
        ROW_NUMBER() OVER (
          PARTITION BY t."kind"
          ORDER BY SUM(tally."count") DESC, t."key" ASC
        ) AS "rank"
      FROM "PopularJunkOracleQueryTerm" t
      JOIN tally ON tally."id" = t."queryId"
      GROUP BY t."kind", t."key"
    )
    SELECT "kind", "key" FROM ranked
    WHERE "rank" <= ${TOP_TERMS_PER_KIND_LIMIT}
    ORDER BY "kind", "count" DESC, "key" ASC
  `;
}

async function handlePopular(
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  // Recent first; all-time only if the window can't rank a list worth showing.
  // One period for both lists, so the two never mix tallies.
  const recent = await getPrisma().popularJunkOracleQueryDay.aggregate({
    _sum: { count: true },
    where: { day: { gte: utcDayStart(POPULAR_WINDOW_DAYS) } },
  });
  const period: PopularPeriod = (recent._sum.count ?? 0) >= MIN_RECENT_SEARCHES ? 'recent' : 'allTime';

  const [queries, terms] = await Promise.all([
    rankedQueries(period),
    rankedTerms(period),
  ]);

  // The query already returns each kind's rows most-searched first, so appending in
  // order is what puts them in order.
  const termsByKind: Record<PopularTermKind, string[]> = {
    equipment: [],
    blessing: [],
    rank: [],
    category: [],
    quality: [],
    grade: [],
  };
  for (const row of terms) {
    termsByKind[row.kind].push(row.key);
  }

  // `count` orders the rows but never ships: search volume is ours to see, not the
  // player's (see `PopularQueryEntry`).
  const body: PopularResult = {
    period,
    queries: queries.map((query) => ({
      filters: filtersFromSignature(query.signature),
    })),
    terms: termsByKind,
  };
  res.status(HttpStatusCode.OK).json(body);
}

export const popularRouter = express.Router();

popularRouter.get('/popular', (req, res, next) => {
  handlePopular(req, res).catch(next);
});
