import { Prisma, PrismaClient } from '@local-prisma/generated/client';
import { EquipmentRankKind } from '@shared/domain/rank';

import { EquipmentTaxonomyEntry } from './equipmentTaxonomy.mapping';

/** Outcome of the enrichment pass — surfaced by the orchestrator for logging. */
export interface SeedTaxonomyResult {
  /** Total `Equipment` rows in the DB (all junk/blessing-sourced). */
  totalEquipment: number,
  /** How many got enriched (rank, and category where the source provided one). */
  matched: number,
  /** Matched items that got a rank but no category (source lacked a weight class). */
  matchedWithoutCategory: string[],
  /** DB equipment names absent from the CSVs (name drift or genuinely absent). */
  unmatchedNames: string[],
  /**
   * Matched items whose rank is NOT junk-obtainable — a data anomaly, since every
   * `Equipment` row here is junk-sourced (expected empty; only "Worn" is non-junk).
   */
  anomalies: { name: string, rank: EquipmentRankKind }[],
}

/**
 * Enriches existing `Equipment` rows with `categoryCode` + `rank` from the
 * Fasterthoughts taxonomy, matched by exact name. **Only updates existing rows**
 * — it never creates equipment (items that don't drop from junk are out of scope
 * here; the seed only knows junk-sourced pieces). One bulk `UPDATE ... FROM
 * (VALUES ...)` keyed by id, mirroring the maxDrop update in
 * `seedDropRatesByJunk`. Returns match/anomaly stats for the caller to log.
 */
export async function seedEquipmentTaxonomy(
  prisma: PrismaClient,
  taxonomyByName: Map<string, EquipmentTaxonomyEntry>,
  obtainableRanks: ReadonlySet<EquipmentRankKind>,
): Promise<SeedTaxonomyResult> {
  const existing = await prisma.equipment.findMany({ select: { id: true, name: true } });

  const matched: { id: string, name: string, entry: EquipmentTaxonomyEntry }[] = [];
  const unmatchedNames: string[] = [];
  for (const item of existing) {
    const entry = taxonomyByName.get(item.name);
    if (entry) {
      matched.push({ id: item.id, name: item.name, entry });
    } else {
      unmatchedNames.push(item.name);
    }
  }

  const values = matched.map(({ id, entry }) => Prisma.sql`(
    ${id}::text, ${entry.categoryCode}::text, ${entry.rank}::"EquipmentRankKind"
  )`);
  if (values.length > 0) {
    await prisma.$executeRaw`
      UPDATE "Equipment" AS e
      SET "categoryCode" = v.category_code, "rank" = v.rank
      FROM (VALUES ${Prisma.join(values)}) AS v(id, category_code, rank)
      WHERE e.id = v.id
    `;
  }

  const anomalies = matched
    .filter(({ entry }) => !obtainableRanks.has(entry.rank))
    .map(({ name, entry }) => ({ name, rank: entry.rank }));

  const matchedWithoutCategory = matched
    .filter(({ entry }) => entry.categoryCode === null)
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right));

  return {
    totalEquipment: existing.length,
    matched: matched.length,
    matchedWithoutCategory,
    unmatchedNames: unmatchedNames.sort((left, right) => left.localeCompare(right)),
    anomalies,
  };
}
