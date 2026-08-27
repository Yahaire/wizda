import express from 'express';
import { z } from 'zod';

import { trackEnhancementQuery } from '@app/analytics';
import { sendErrorResponse } from '@app/http';
import { pickLocalizedName } from '@app/localizedNames';
import { getPrisma } from '@app/prisma';
import { ErrorCode, HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import {
    DEFAULT_TARGET_ENHANCEMENT_LEVEL, EnhancementBlessingReference, EnhancementNoteCode,
    EnhancementOddsResult, EnhancementReference, EnhancementSlotCandidate, EnhancementSlotOutcome,
    EnhancementSlotReference, EnhancementWarningCode
} from '@shared/api/endpoints/enhancementOdds.models';
import {
    checkBlessingSlotState, MAX_BLESSING_SLOTS, MAX_ENHANCEMENT_LEVEL
} from '@shared/domain/blessingSlots';
import {
    BLESSING_VALUE_SOURCE_CODES, BlessingValueSourceRole
} from '@shared/domain/blessingValueSources';
import {
    enhancementOdds, EnhancementSlotInput, EnhancementTargetInput, ValueDistribution, valueRange
} from '@shared/domain/enhancementMath';
import { BLESSINGS } from '@shared/domain/stats';

/** Valid blessing codes, from the shared catalog — the public key for every blessing field. */
const validBlessingCodes = new Set(BLESSINGS.map((blessing) => blessing.code));

/** A quality/grade level: an integer star/grade in 1–5. */
const levelSchema = z.number().int().min(1).max(5);
/** A blessing slot, 1–4. */
const slotSchema = z.number().int().min(1).max(MAX_BLESSING_SLOTS);
/** An enhancement level, +0 to +20. */
const enhancementLevelSchema = z.number().int().min(0).max(MAX_ENHANCEMENT_LEVEL);

const slotStateSchema = z.object({
  slot: slotSchema,
  blessingCode: z.string().min(1).optional(),
  // Values are positive integers: a blessing never rolls zero or below.
  value: z.number().int().min(1).optional(),
  isRefined: z.boolean().optional(),
  planRefineStoneQuality: levelSchema.optional(),
});

const targetSchema = z.object({
  blessingCode: z.string().min(1),
  minValue: z.number().int().optional(),
});

const enhancementOddsSchema = z.object({
  equipment: z.string().min(1),
  quality: levelSchema,
  enhancementLevel: enhancementLevelSchema,
  targetEnhancementLevel: enhancementLevelSchema.optional(),
  initialGrade: levelSchema.optional(),
  alteredSlot: slotSchema.optional(),
  alteredFrom: z.string().min(1).optional(),
  slots: z.array(slotStateSchema).max(MAX_BLESSING_SLOTS),
  targets: z.array(targetSchema),
});

const referenceQuerySchema = z.object({
  equipment: z.string().min(1),
  quality: z.coerce.number().int().min(1).max(5),
});

/** Prisma `select` for the equipment fields both handlers need. */
const equipmentSelect = {
  id: true,
  name: true,
  nameJa: true,
  nameKo: true,
  nameDe: true,
  blessingValueGroupCode: true,
} as const;

type EquipmentRow = {
  id: string,
  name: string,
  nameJa: string | null,
  nameKo: string | null,
  nameDe: string | null,
  blessingValueGroupCode: string | null,
};

/**
 * Look up the queried piece by name, or send the 400 and return null. Names come
 * from a select, so an unknown one means a stale client rather than a typo to
 * tolerate — the same stance `junkToGuarantee.ts` takes.
 */
async function findEquipment(
  res: express.Response,
  name: string,
): Promise<EquipmentRow | null> {
  const equipment = await getPrisma().equipment.findUnique({
    where: { name },
    select: equipmentSelect,
  });
  if (!equipment) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.UNKNOWN_EQUIPMENT,
      `Unknown equipment name: ${name}`,
    );
    return null;
  }
  return equipment;
}

/**
 * The piece's per-slot blessing-identity odds, as the slot-indexed maps the math
 * expects (index 0 is slot 1). Only nonzero rates are stored, so a slot with no
 * rows becomes an empty map rather than a hole.
 */
async function loadSlotBlessingRates(equipmentId: string): Promise<Map<string, number>[]> {
  const rows = await getPrisma().equipmentBlessingDropRate.findMany({
    where: { equipmentId },
    select: { slot: true, blessingCode: true, rate: true },
  });

  const bySlot = Array.from({ length: MAX_BLESSING_SLOTS }, () => new Map<string, number>());
  for (const row of rows) {
    bySlot[row.slot - 1]?.set(row.blessingCode, row.rate);
  }
  return bySlot;
}

/**
 * Value distributions for one (group, quality), keyed by blessing then by source
 * **role**. Rates are stored sparsely — only nonzero values get a row — so each
 * distribution is densified over the run from its lowest to its highest value,
 * which is exactly `ValueDistribution`'s shape.
 */
async function loadValueDistributions(
  groupCode: string,
  quality: number,
  roles: readonly BlessingValueSourceRole[],
): Promise<Map<string, Map<BlessingValueSourceRole, ValueDistribution>>> {
  const roleBySourceCode = new Map<string, BlessingValueSourceRole>(
    roles.map((role) => [BLESSING_VALUE_SOURCE_CODES[role], role]),
  );

  const rows = await getPrisma().blessingValueRate.findMany({
    where: {
      groupCode,
      quality,
      sourceCode: { in: [...roleBySourceCode.keys()] },
    },
    select: { sourceCode: true, blessingCode: true, value: true, rate: true },
    orderBy: { value: 'asc' },
  });

  const sparse = new Map<string, Map<BlessingValueSourceRole, Map<number, number>>>();
  for (const row of rows) {
    const role = roleBySourceCode.get(row.sourceCode);
    if (!role) {
      continue;
    }
    let byRole = sparse.get(row.blessingCode);
    if (!byRole) {
      byRole = new Map();
      sparse.set(row.blessingCode, byRole);
    }
    let byValue = byRole.get(role);
    if (!byValue) {
      byValue = new Map();
      byRole.set(role, byValue);
    }
    byValue.set(row.value, row.rate);
  }

  const dense = new Map<string, Map<BlessingValueSourceRole, ValueDistribution>>();
  for (const [blessingCode, byRole] of sparse) {
    const distributions = new Map<BlessingValueSourceRole, ValueDistribution>();
    for (const [role, byValue] of byRole) {
      const values = [...byValue.keys()];
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      distributions.set(role, {
        minValue,
        probabilities: Array.from(
          { length: maxValue - minValue + 1 },
          (_unused, index) => byValue.get(minValue + index) ?? 0,
        ),
      });
    }
    dense.set(blessingCode, distributions);
  }
  return dense;
}

/** The derived milestone bonus per blessing for one (group, quality). */
async function loadBonuses(
  groupCode: string,
  quality: number,
): Promise<Map<string, ValueDistribution & { isVerified: boolean }>> {
  const rows = await getPrisma().blessingValueBonus.findMany({
    where: { groupCode, quality },
    select: { blessingCode: true, minValue: true, probabilities: true, isVerified: true },
  });

  return new Map(rows.map((row) => [
    row.blessingCode,
    { minValue: row.minValue, probabilities: row.probabilities, isVerified: row.isVerified },
  ]));
}

/** Strip a distribution to the wire shape (drops the extra `isVerified` on a bonus). */
function toValueDistribution(dist: ValueDistribution): ValueDistribution {
  return { minValue: dist.minValue, probabilities: [...dist.probabilities] };
}

/**
 * Validate everything zod's shape check can't: that the blessing codes exist,
 * that the described piece is one the game can produce, and that no planned
 * refinement lands on a slot that already carries one. Sends the error response
 * itself and returns false, so the caller just returns.
 */
function validateQuery(
  res: express.Response,
  query: z.infer<typeof enhancementOddsSchema>,
  unrefinedCeilingFor: (slot: number) => number | null,
): boolean {
  const { slots, targets, enhancementLevel, alteredSlot, alteredFrom, initialGrade } = query;
  const targetEnhancementLevel = query.targetEnhancementLevel ?? DEFAULT_TARGET_ENHANCEMENT_LEVEL;

  if (targets.length === 0) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.NO_QUERY,
      'Name at least one blessing you want to end up with.',
    );
    return false;
  }

  if (targetEnhancementLevel < enhancementLevel) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.INVALID_QUERY,
      `targetEnhancementLevel (+${targetEnhancementLevel}) cannot be below the piece's `
      + `current enhancementLevel (+${enhancementLevel}) — enhancing only goes up.`,
    );
    return false;
  }

  const duplicateSlots = slots.filter(
    (state, index) => slots.findIndex((other) => other.slot === state.slot) !== index,
  );
  if (duplicateSlots.length > 0) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.INVALID_QUERY,
      `Slot ${duplicateSlots[0]?.slot} was given more than once.`,
    );
    return false;
  }

  const unknownCodes = [
    ...slots.flatMap((state) => (state.blessingCode ? [state.blessingCode] : [])),
    ...targets.map((target) => target.blessingCode),
    ...(alteredFrom ? [alteredFrom] : []),
  ].filter((code) => !validBlessingCodes.has(code));
  if (unknownCodes.length > 0) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.UNKNOWN_BLESSING,
      `Unknown blessing code(s): ${[...new Set(unknownCodes)].join(', ')}`,
    );
    return false;
  }

  const missingValue = slots.find((state) => state.blessingCode && state.value === undefined);
  if (missingValue) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.INVALID_QUERY,
      `Slot ${missingValue.slot} names a blessing but no value. `
      + "Give the number the item screen shows for it.",
    );
    return false;
  }

  const occupiedSlots = Array.from(
    { length: MAX_BLESSING_SLOTS },
    (_unused, index) => slots.some((state) => state.slot === index + 1 && Boolean(state.blessingCode)),
  );
  const problem = checkBlessingSlotState(occupiedSlots, enhancementLevel, initialGrade ?? null);
  if (problem) {
    sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, ErrorCode.INVALID_SLOT_STATE, problem.message);
    return false;
  }

  if (alteredFrom !== undefined && alteredSlot === undefined) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.INVALID_QUERY,
      'alteredFrom says what a slot used to hold, so it needs alteredSlot to say which slot.',
    );
    return false;
  }
  if (alteredSlot !== undefined && !occupiedSlots[alteredSlot - 1]) {
    sendErrorResponse(
      res,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.INVALID_QUERY,
      `Slot ${alteredSlot} is empty, so it can't be the altered one — an Alteration Stone `
      + 'replaces a blessing that is already there.',
    );
    return false;
  }

  // A new Refinement Stone replaces the one already on a slot, so answering that
  // needs the existing refinement subtracted back out of the displayed value.
  // Not supported yet — see docs/calculation/enhancement.md.
  for (const state of slots) {
    if (state.planRefineStoneQuality === undefined) {
      continue;
    }

    if (!state.blessingCode) {
      sendErrorResponse(
        res,
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.INVALID_QUERY,
        `Slot ${state.slot} is empty but plans a refinement. A Refinement Stone adds to a `
        + 'blessing, so name the blessing a milestone will put there, or drop the plan.',
      );
      return false;
    }

    // Demanded rather than inferred: whether a slot is already refined decides
    // whether the answer is even computable, and the displayed value alone can't
    // always settle it (a past Full Alteration Stone raises the unrefined ceiling
    // in a way this query never asks about). Guessing would return a silently
    // wrong number, so the client has to say.
    if (state.isRefined === undefined) {
      sendErrorResponse(
        res,
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.INVALID_QUERY,
        `Slot ${state.slot} plans a refinement, so say whether it already carries one `
        + '(`isRefined`). A new stone replaces an existing refinement rather than adding '
        + "to it, so the answer differs and we won't guess.",
      );
      return false;
    }

    // The backstop: a value above anything reachable unrefined contradicts an
    // `isRefined: false`, so trust the number over the flag.
    const ceiling = unrefinedCeilingFor(state.slot);
    const exceedsUnrefined = ceiling !== null
      && state.value !== undefined
      && state.value > ceiling;
    if (state.isRefined || exceedsUnrefined) {
      sendErrorResponse(
        res,
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.ALREADY_REFINED,
        `Slot ${state.slot} already carries a refinement, and a new Refinement Stone replaces `
        + "the old one rather than adding to it. Working out what you'd end up with isn't "
        + 'supported yet.',
      );
      return false;
    }
  }

  return true;
}

async function handleEnhancementOdds(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const parsed = enhancementOddsSchema.safeParse(req.body);
  if (!parsed.success) {
    sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, ErrorCode.INVALID_QUERY, parsed.error.message);
    return;
  }

  const query = parsed.data;
  const targetEnhancementLevel = query.targetEnhancementLevel ?? DEFAULT_TARGET_ENHANCEMENT_LEVEL;

  const equipment = await findEquipment(res, query.equipment);
  if (!equipment) {
    return; // response already sent
  }

  const groupCode = equipment.blessingValueGroupCode;
  const [slotBlessingRates, valueDistributions, bonuses] = await Promise.all([
    loadSlotBlessingRates(equipment.id),
    groupCode
      ? loadValueDistributions(groupCode, query.quality, [BlessingValueSourceRole.DROP])
      : Promise.resolve(new Map<string, Map<BlessingValueSourceRole, ValueDistribution>>()),
    groupCode
      ? loadBonuses(groupCode, query.quality)
      : Promise.resolve(new Map<string, ValueDistribution & { isVerified: boolean }>()),
  ]);

  const dropByBlessing = new Map<string, ValueDistribution>();
  for (const [blessingCode, byRole] of valueDistributions) {
    const drop = byRole.get(BlessingValueSourceRole.DROP);
    if (drop) {
      dropByBlessing.set(blessingCode, drop);
    }
  }

  // The one place a slot's history is consulted: a value above what the slot
  // could reach unrefined means a Refinement Stone is already on it.
  const unrefinedCeilingFor = (slot: number): number | null => {
    const state = query.slots.find((candidate) => candidate.slot === slot);
    const drop = state?.blessingCode ? dropByBlessing.get(state.blessingCode) : undefined;
    if (!drop) {
      return null; // no data to judge against — take the player at their word
    }
    const bonus = state?.blessingCode ? bonuses.get(state.blessingCode) : undefined;
    // The most a slot can show without a refinement: its drop roll plus at most
    // two bonuses (its milestone, and a Full Alteration Stone's).
    const bonusCeiling = bonus ? (valueRange(bonus).maxValue * 2) : 0;
    return valueRange(drop).maxValue + bonusCeiling;
  };

  if (!validateQuery(res, query, unrefinedCeilingFor)) {
    return; // response already sent
  }

  const slots: EnhancementSlotInput[] = Array.from(
    { length: MAX_BLESSING_SLOTS },
    (_unused, index) => {
      const state = query.slots.find((candidate) => candidate.slot === index + 1);
      return {
        slot: index + 1,
        blessingCode: state?.blessingCode ?? null,
        value: state?.value ?? null,
        planRefineStoneQuality: state?.planRefineStoneQuality ?? null,
      };
    },
  );

  const targets: EnhancementTargetInput[] = query.targets.map((target) => ({
    blessingCode: target.blessingCode,
    minValue: target.minValue ?? null,
  }));

  const outcome = enhancementOdds({
    enhancementLevel: query.enhancementLevel,
    targetEnhancementLevel,
    slots,
    targets,
    alteredSlot: query.alteredSlot ?? null,
    alteredFrom: query.alteredFrom ?? null,
    slotBlessingRates,
    dropByBlessing,
    bonusByBlessing: bonuses,
  });

  const willFillAnySlot = outcome.slots.some((slot) => slot.candidates !== null);

  const warnings: EnhancementWarningCode[] = [];
  if (!groupCode) {
    warnings.push(EnhancementWarningCode.NO_VALUE_GROUP);
  }
  if (willFillAnySlot && slotBlessingRates.every((rates) => rates.size === 0)) {
    warnings.push(EnhancementWarningCode.NO_BLESSING_RATES);
  }
  if (outcome.missingBlessingData.length > 0) {
    warnings.push(EnhancementWarningCode.MISSING_VALUE_DATA);
  }
  const bonusesInPlay = outcome.slots
    .filter((slot) => !slot.isFinal && slot.blessingCode !== null)
    .map((slot) => slot.blessingCode ?? '');
  if (bonusesInPlay.some((code) => bonuses.get(code)?.isVerified === false)) {
    warnings.push(EnhancementWarningCode.UNVERIFIED_BONUS);
  }

  const notes: EnhancementNoteCode[] = [];
  if (willFillAnySlot) {
    notes.push(EnhancementNoteCode.EMPTY_SLOT_RULE_EMPIRICAL);
    if (outcome.slots.some((slot) => slot.candidates !== null && slot.slot > 1)) {
      notes.push(EnhancementNoteCode.LATER_SLOTS_ASSUMED);
    }
  }
  if (query.alteredSlot !== undefined) {
    notes.push(EnhancementNoteCode.NO_STACK_ON_ORIGINALS);
    if (query.alteredFrom === undefined) {
      notes.push(EnhancementNoteCode.ALTERED_ORIGIN_UNKNOWN);
    }
  }

  const isComputable = warnings.every(
    (warning) => warning === EnhancementWarningCode.UNVERIFIED_BONUS,
  );

  const body: EnhancementOddsResult = {
    equipment: equipment.name,
    equipmentDisplayName: pickLocalizedName(equipment, req.locale),
    probability: isComputable ? outcome.probability : null,
    valueGroupCode: groupCode,
    remainingMilestones: [...outcome.remainingMilestones],
    slots: outcome.slots.map((slot): EnhancementSlotOutcome => ({
      slot: slot.slot,
      isFinal: slot.isFinal,
      // Spread, not assigned, so absent keys never reach the wire as `undefined`
      // — the same convention the guarantee results use.
      ...(slot.blessingCode !== null && { blessingCode: slot.blessingCode }),
      ...(slot.valueDistribution !== null && {
        valueDistribution: toValueDistribution(slot.valueDistribution),
      }),
      ...(slot.candidates !== null && {
        candidates: slot.candidates.map((candidate): EnhancementSlotCandidate => ({
          blessingCode: candidate.blessingCode,
          probability: candidate.probability,
          valueDistribution: toValueDistribution(candidate.valueDistribution),
        })),
      }),
    })),
    notes,
    warnings,
  };

  trackEnhancementQuery(req, {
    slotCount: query.slots.filter((state) => Boolean(state.blessingCode)).length,
    freeSlotCount: outcome.slots.filter((slot) => slot.candidates !== null).length,
    targetCount: query.targets.length,
    enhancementLevel: query.enhancementLevel,
    targetEnhancementLevel,
    hasAlteredSlot: query.alteredSlot !== undefined,
    hasProbability: body.probability !== null,
  });

  res.status(HttpStatusCode.OK).json(body);
}

async function handleEnhancementReference(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const parsed = referenceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, ErrorCode.INVALID_QUERY, parsed.error.message);
    return;
  }

  const { equipment: equipmentName, quality } = parsed.data;
  const equipment = await findEquipment(res, equipmentName);
  if (!equipment) {
    return; // response already sent
  }

  const groupCode = equipment.blessingValueGroupCode;
  const allRoles = [
    BlessingValueSourceRole.DROP,
    BlessingValueSourceRole.LESSER_FAS,
    BlessingValueSourceRole.FAS,
  ];
  const [slotBlessingRates, valueDistributions, bonuses] = await Promise.all([
    loadSlotBlessingRates(equipment.id),
    groupCode
      ? loadValueDistributions(groupCode, quality, allRoles)
      : Promise.resolve(new Map<string, Map<BlessingValueSourceRole, ValueDistribution>>()),
    groupCode
      ? loadBonuses(groupCode, quality)
      : Promise.resolve(new Map<string, ValueDistribution & { isVerified: boolean }>()),
  ]);

  const blessings: EnhancementBlessingReference[] = BLESSINGS.map((blessing) => {
    const byRole = valueDistributions.get(blessing.code);
    const bonus = bonuses.get(blessing.code);
    return {
      blessingCode: blessing.code,
      drop: byRole?.get(BlessingValueSourceRole.DROP) ?? null,
      lesserFas: byRole?.get(BlessingValueSourceRole.LESSER_FAS) ?? null,
      fas: byRole?.get(BlessingValueSourceRole.FAS) ?? null,
      bonus: bonus
        ? { ...toValueDistribution(bonus), isVerified: bonus.isVerified }
        : null,
    };
  });

  const slots: EnhancementSlotReference[] = slotBlessingRates.map((rates, index) => {
    const entries = [...rates.entries()]
      .map(([blessingCode, rate]) => ({ blessingCode, rate }))
      .sort((left, right) => right.rate - left.rate);
    return {
      slot: index + 1,
      rates: entries,
      // A fixed-blessing-type slot always rolls the same thing. Read per slot,
      // so a partially-fixed piece needs no special case — see docs/stones.md.
      isFixed: entries.length === 1,
    };
  });

  const warnings: EnhancementWarningCode[] = [];
  if (!groupCode) {
    warnings.push(EnhancementWarningCode.NO_VALUE_GROUP);
  }
  if (slots.every((slot) => slot.rates.length === 0)) {
    warnings.push(EnhancementWarningCode.NO_BLESSING_RATES);
  }
  if (groupCode && blessings.some((blessing) => blessing.drop === null)) {
    warnings.push(EnhancementWarningCode.MISSING_VALUE_DATA);
  }
  if (blessings.some((blessing) => blessing.bonus?.isVerified === false)) {
    warnings.push(EnhancementWarningCode.UNVERIFIED_BONUS);
  }

  const body: EnhancementReference = {
    equipment: equipment.name,
    equipmentDisplayName: pickLocalizedName(equipment, req.locale),
    quality,
    valueGroupCode: groupCode,
    blessings,
    slots,
    warnings,
  };
  res.status(HttpStatusCode.OK).json(body);
}

export const enhancementOddsRouter = express.Router();

enhancementOddsRouter.post('/', (req, res, next) => {
  handleEnhancementOdds(req, res).catch(next);
});

enhancementOddsRouter.get('/reference', (req, res, next) => {
  handleEnhancementReference(req, res).catch(next);
});
