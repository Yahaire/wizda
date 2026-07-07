import express from 'express';
import { z } from 'zod';

import { Prisma } from '@local-prisma/generated/client';

import { sendErrorResponse } from '@app/http';
import { getPrisma } from '@app/prisma';
import { ErrorCode, HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import {
    BLESSING_ESTIMATE_NOTE,
    CertaintyCurvePoint,
    CertaintyCurveResult,
    DEFAULT_CERTAINTY,
    JunkGuaranteeEntry,
    JunkToGuaranteeResult,
} from '@shared/api/endpoints/junkToGuarantee.models';
import {
    blessingPresenceByGrade,
    DropRateRow,
    junksNeededForConfidence,
    matchProbabilityForJunk,
    MatchQuery,
} from '@shared/domain/dropRateMath';
import { BLESSINGS } from '@shared/domain/stats';

/** A quality/grade level: an integer star/grade in 1–5. */
const levelSchema = z.number().int().min(1).max(5);

/** Shared filter fields (see `GuaranteeFilters`). Unknown keys are stripped. */
const filterShape = {
  equipment: z.array(z.string().min(1)).optional(),
  quality: z.array(levelSchema).optional(),
  grade: z.array(levelSchema).optional(),
  blessings: z.array(z.string().min(1)).optional(),
};

/** Valid blessing codes, from the shared catalog — the public key for the AND filter. */
const validBlessingCodes = new Set(BLESSINGS.map((blessing) => blessing.code));

/**
 * A grade-presence vector that excludes an equipment at every grade. Used as the
 * fallback for an equipment with no seeded blessing data when blessings are
 * required: without evidence it can roll them, we can't claim it as a source.
 */
const NO_BLESSING_PRESENCE: readonly number[] = [0, 0, 0, 0, 0];

const junkToGuaranteeSchema = z.object({
  certainty: z.number().gt(0).lt(1).optional(),
  ...filterShape,
});

const certaintyCurveSchema = z.object({
  junkName: z.string().min(1),
  certainties: z.array(z.number().gt(0).lt(1)).min(1),
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
  equipmentId: true,
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

/**
 * Flatten a Prisma drop-rate row into the pure-math {@link DropRateRow} shape.
 * `gradePresence` (the row equipment's per-grade blessing-presence vector) is
 * attached only for blessing queries — omitted otherwise (respects
 * exactOptionalPropertyTypes), leaving the exact no-blessing path untouched.
 */
export function toDropRateRow(
  row: DropRateRowWithJunk,
  gradePresence?: readonly number[],
): DropRateRow {
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
    ...(gradePresence ? { gradePresence } : {}),
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

/**
 * Validate the required-blessing codes against the shared catalog, failing loud
 * (400) on any unknown code — like equipment names, these come from a select, so
 * an unknown code means a stale client. Returns the de-duped codes ([] when no
 * blessing filter was given), or `null` after sending the error response.
 */
function resolveBlessingCodes(
  res: express.Response,
  blessings: string[] | undefined,
): string[] | null {
  if (!blessings || blessings.length === 0) {
    return [];
  }

  const codes = [...new Set(blessings)];
  const unknown = codes.filter((code) => !validBlessingCodes.has(code));
  if (unknown.length > 0) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.UNKNOWN_BLESSING,
      `Unknown blessing code(s): ${unknown.join(', ')}`,
    );
    return null;
  }

  return codes;
}

/**
 * For each given equipment, the per-grade probability that all `requiredCodes`
 * blessings are present ({@link blessingPresenceByGrade}). Fetches the
 * equipment's per-slot blessing marginals in one query and reduces them to a
 * length-5 vector per equipment. Presence is equipment-only (junk-independent),
 * so it's computed once here and shared across every drop row of that equipment.
 */
async function buildGradePresenceByEquipment(
  equipmentIds: readonly string[],
  requiredCodes: readonly string[],
): Promise<Map<string, number[]>> {
  const blessingRows = await getPrisma().equipmentBlessingDropRate.findMany({
    where: { equipmentId: { in: [...equipmentIds] } },
    select: {
      equipmentId: true,
      slot: true,
      blessingCode: true,
      rate: true,
    },
  });

  // Group into per-equipment slot marginals: slots[slot - 1] maps code → rate.
  const slotsByEquipment = new Map<string, Map<string, number>[]>();
  for (const row of blessingRows) {
    let slots = slotsByEquipment.get(row.equipmentId);
    if (!slots) {
      slots = [];
      slotsByEquipment.set(row.equipmentId, slots);
    }
    const slotIndex = row.slot - 1;
    let marginal = slots[slotIndex];
    if (!marginal) {
      marginal = new Map();
      slots[slotIndex] = marginal;
    }
    marginal.set(row.blessingCode, row.rate);
  }

  const presenceByEquipment = new Map<string, number[]>();
  for (const [equipmentId, slots] of slotsByEquipment) {
    // Densify: a slot with no rows becomes an empty marginal so indices align.
    const dense = Array.from(
      { length: slots.length },
      (_unused, index) => slots[index] ?? new Map<string, number>(),
    );
    presenceByEquipment.set(equipmentId, blessingPresenceByGrade(dense, [...requiredCodes]));
  }
  return presenceByEquipment;
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

  const { certainty = DEFAULT_CERTAINTY, equipment, quality, grade, blessings } = parsed.data;

  const equipmentIds = await resolveEquipmentIds(res, equipment);
  if (equipmentIds === null) {
    return; // response already sent
  }

  const blessingCodes = resolveBlessingCodes(res, blessings);
  if (blessingCodes === null) {
    return; // response already sent
  }
  const hasBlessings = blessingCodes.length > 0;

  const rows = await getPrisma().equipmentDropRate.findMany({
    ...(equipmentIds ? { where: { equipmentId: { in: equipmentIds } } } : {}),
    select: dropRateRowSelect,
  });

  // Blessing presence is per-equipment; compute it once for the equipment that
  // actually appear in these rows, then share it across their rows below.
  const presenceByEquipment = hasBlessings
    ? await buildGradePresenceByEquipment(
        [...new Set(rows.map((row) => row.equipmentId))],
        blessingCodes,
      )
    : null;

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
    const gradePresence = presenceByEquipment
      ? (presenceByEquipment.get(row.equipmentId) ?? NO_BLESSING_PRESENCE)
      : undefined;
    aggregate.rows.push(toDropRateRow(row, gradePresence));
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
    ...(hasBlessings ? { estimated: true, estimatedNote: BLESSING_ESTIMATE_NOTE } : {}),
    results,
  };
  res.status(HttpStatusCode.OK).json(body);
}

async function handleCertaintyCurve(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const parsed = certaintyCurveSchema.safeParse(req.body);
  if (!parsed.success) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.INVALID_QUERY,
      parsed.error.message,
    );
    return;
  }

  const { junkName, certainties, equipment, quality, grade, blessings } = parsed.data;

  // The junk is addressed by name — a missing one is a 404 (unlike the equipment
  // filter's 400, this is the single target resource, not a filter value).
  const junk = await getPrisma().junk.findUnique({
    where: { name: junkName },
    select: { id: true, name: true },
  });
  if (!junk) {
    sendErrorResponse(
      res,
      HttpStatusCode.NOT_FOUND,
      ErrorCode.UNKNOWN_JUNK,
      `Unknown junk name: ${junkName}`,
    );
    return;
  }

  const equipmentIds = await resolveEquipmentIds(res, equipment);
  if (equipmentIds === null) {
    return; // response already sent
  }

  const blessingCodes = resolveBlessingCodes(res, blessings);
  if (blessingCodes === null) {
    return; // response already sent
  }
  const hasBlessings = blessingCodes.length > 0;

  const rows = await getPrisma().equipmentDropRate.findMany({
    where: {
      junkId: junk.id,
      ...(equipmentIds ? { equipmentId: { in: equipmentIds } } : {}),
    },
    select: dropRateRowSelect,
  });

  const presenceByEquipment = hasBlessings
    ? await buildGradePresenceByEquipment(
        [...new Set(rows.map((row) => row.equipmentId))],
        blessingCodes,
      )
    : null;

  const mathRows = rows.map((row) => toDropRateRow(
    row,
    presenceByEquipment
      ? (presenceByEquipment.get(row.equipmentId) ?? NO_BLESSING_PRESENCE)
      : undefined,
  ));

  const matchQuery = toMatchQuery({ quality, grade });
  const probabilityPerJunk = matchProbabilityForJunk(mathRows, matchQuery);

  const points: CertaintyCurvePoint[] = certainties.map((certainty) => ({
    certainty,
    junkNeeded: junksNeededForConfidence(probabilityPerJunk, certainty),
  }));

  const body: CertaintyCurveResult = {
    junkName: junk.name,
    probabilityPerJunk,
    ...(hasBlessings ? { estimated: true, estimatedNote: BLESSING_ESTIMATE_NOTE } : {}),
    points,
  };
  res.status(HttpStatusCode.OK).json(body);
}

export const junkToGuaranteeRouter = express.Router();

junkToGuaranteeRouter.post('/', (req, res, next) => {
  handleJunkToGuarantee(req, res).catch(next);
});

junkToGuaranteeRouter.post('/curve', (req, res, next) => {
  handleCertaintyCurve(req, res).catch(next);
});
