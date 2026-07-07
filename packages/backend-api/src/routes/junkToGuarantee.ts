import express from 'express';
import { z } from 'zod';

import { Prisma } from '@local-prisma/generated/client';

import { sendErrorResponse } from '@app/http';
import { getPrisma } from '@app/prisma';
import { ErrorCode, HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import {
    DEFAULT_CERTAINTY, JunkGuaranteeEntry, JunkToGuaranteeResult
} from '@shared/api/endpoints/junkToGuarantee.models';
import {
    DropRateRow, junksNeededForConfidence, matchProbabilityForJunk, MatchQuery
} from '@shared/domain/dropRateMath';

/** A quality/grade level: an integer star/grade in 1–5. */
const levelSchema = z.number().int().min(1).max(5);

/** Shared filter fields (see `GuaranteeFilters`). Unknown keys are stripped. */
const filterShape = {
  equipment: z.array(z.string().min(1)).optional(),
  quality: z.array(levelSchema).optional(),
  grade: z.array(levelSchema).optional(),
};

const junkToGuaranteeSchema = z.object({
  certainty: z.number().gt(0).lt(1).optional(),
  ...filterShape,
});

/** Build the pure-math query, omitting wildcard axes (respects exactOptionalPropertyTypes). */
export function toMatchQuery(
  filters: { quality?: number[] | undefined, grade?: number[] | undefined },
): MatchQuery {
  const matchQuery: MatchQuery = {};
  if (filters.quality) {
    matchQuery.quality = filters.quality;
  }
  if (filters.grade) {
    matchQuery.grade = filters.grade;
  }
  return matchQuery;
}

/** Prisma `select` for the fields the calc needs from a drop-rate row + its junk. */
export const dropRateRowSelect = {
  junkId: true,
  groupDropRate: true,
  dropRate: true,
  quality1Rate: true,
  quality2Rate: true,
  quality3Rate: true,
  quality4Rate: true,
  quality5Rate: true,
  grade1Rate: true,
  grade2Rate: true,
  grade3Rate: true,
  grade4Rate: true,
  grade5Rate: true,
  junk: { select: { name: true, hasMultiplePools: true } },
} satisfies Prisma.EquipmentDropRateSelect;

/** The exact row shape returned for {@link dropRateRowSelect} — derived from
 * Prisma's generated types, so it can never drift from the `select` above. */
type DropRateRowWithJunk = Prisma.EquipmentDropRateGetPayload<{ select: typeof dropRateRowSelect }>;

/** Flatten a Prisma drop-rate row into the pure-math {@link DropRateRow} shape. */
export function toDropRateRow(row: DropRateRowWithJunk): DropRateRow {
  return {
    groupDropRate: row.groupDropRate,
    dropRate: row.dropRate,
    qualityRates: [
      row.quality1Rate,
      row.quality2Rate,
      row.quality3Rate,
      row.quality4Rate,
      row.quality5Rate,
    ],
    gradeRates: [
      row.grade1Rate,
      row.grade2Rate,
      row.grade3Rate,
      row.grade4Rate,
      row.grade5Rate,
    ],
  };
}

/**
 * Resolve equipment names to ids, failing loud (400) on any unknown name — the
 * client picks these from a select, so an unknown name means a stale client, not
 * a typo to tolerate. Returns `undefined` when no equipment filter was given
 * ("any equipment"). Sends the error response itself and returns `null` on
 * failure, so the caller just returns.
 */
async function resolveEquipmentIds(
  res: express.Response,
  equipment: string[] | undefined,
): Promise<string[] | undefined | null> {
  if (!equipment || equipment.length === 0) {
    return undefined;
  }

  const names = [...new Set(equipment)];
  const found = await getPrisma().equipment.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });

  if (found.length < names.length) {
    const foundNames = new Set(found.map((row) => row.name));
    const missing = names.filter((name) => !foundNames.has(name));
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.UNKNOWN_EQUIPMENT,
      `Unknown equipment name(s): ${missing.join(', ')}`,
    );
    return null;
  }

  return found.map((row) => row.id);
}

async function handleJunkToGuarantee(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const parsed = junkToGuaranteeSchema.safeParse(req.body);
  if (!parsed.success) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.INVALID_QUERY,
      parsed.error.message,
    );
    return;
  }

  const { certainty = DEFAULT_CERTAINTY, equipment, quality, grade } = parsed.data;

  const equipmentIds = await resolveEquipmentIds(res, equipment);
  if (equipmentIds === null) {
    return; // response already sent
  }

  const rows = await getPrisma().equipmentDropRate.findMany({
    ...(equipmentIds ? { where: { equipmentId: { in: equipmentIds } } } : {}),
    select: dropRateRowSelect,
  });

  // Group rows by junk (id is internal; only the name is exposed).
  interface JunkAggregate {
    name: string,
    hasMultiplePools: boolean,
    rows: DropRateRow[],
  }
  const byJunk = new Map<string, JunkAggregate>();
  for (const row of rows) {
    let aggregate = byJunk.get(row.junkId);
    if (!aggregate) {
      aggregate = {
        name: row.junk.name,
        hasMultiplePools: row.junk.hasMultiplePools,
        rows: [],
      };
      byJunk.set(row.junkId, aggregate);
    }
    aggregate.rows.push(toDropRateRow(row));
  }

  const matchQuery = toMatchQuery({ quality, grade });

  const results: JunkGuaranteeEntry[] = [];
  for (const aggregate of byJunk.values()) {
    const probabilityPerJunk = matchProbabilityForJunk(aggregate.rows, matchQuery);
    const junkNeeded = junksNeededForConfidence(probabilityPerJunk, certainty);
    if (junkNeeded === null) {
      continue; // impossible from this junk — omit
    }
    results.push({
      junkName: aggregate.name,
      hasMultiplePools: aggregate.hasMultiplePools,
      probabilityPerJunk,
      junkNeeded,
    });
  }
  results.sort((left, right) => left.junkNeeded - right.junkNeeded);

  const body: JunkToGuaranteeResult = {
    certainty,
    results,
  };
  res.status(HttpStatusCode.OK).json(body);
}

export const junkToGuaranteeRouter = express.Router();

junkToGuaranteeRouter.post('/', (req, res, next) => {
  handleJunkToGuarantee(req, res).catch(next);
});
