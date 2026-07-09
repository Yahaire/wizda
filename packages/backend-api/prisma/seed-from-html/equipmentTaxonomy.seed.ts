import { Prisma, PrismaClient } from '@local-prisma/generated/client';
import { EquipmentTierKind } from '@shared/domain/tier';

import { EquipmentTaxonomyEntry } from './equipmentTaxonomy.mapping';

/** Outcome of the enrichment pass — surfaced by the orchestrator for logging. */
export interface SeedTaxonomyResult {
  /** Total `Equipment` rows in the DB (all junk/blessing-sourced). */
  totalEquipment: number,
  /** How many got enriched (tier, and category where the source provided one). */
  matched: number,
  /** Matched items that got a tier but no category (source lacked a weight class). */
  matchedWithoutCategory: string[],
  /** DB equipment names absent from the CSVs (name drift or genuinely absent). */
  unmatchedNames: string[],
  /**
   * Matched items whose tier is NOT junk-obtainable — a data anomaly, since every
   * `Equipment` row here is junk-sourced (expected empty; only "Worn" is non-junk).
   */
  anomalies: { name: string, tier: EquipmentTierKind }[],
}

/**
 * Enriches existing `Equipment` rows with `categoryCode` + `tier` from the
 * Fasterthoughts taxonomy, matched by exact name. **Only updates existing rows**
 * — it never creates equipment (items that don't drop from junk are out of scope
 * here; the seed only knows junk-sourced pieces). One bulk `UPDATE ... FROM
 * (VALUES ...)` keyed by id, mirroring the maxDrop update in
 * `seedDropRatesByJunk`. Returns match/anomaly stats for the caller to log.
 */
export async function seedEquipmentTaxonomy(
  prisma: PrismaClient,
  taxonomyByName: Map<string, EquipmentTaxonomyEntry>,
  obtainableTiers: ReadonlySet<EquipmentTierKind>,
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
    ${id}::text, ${entry.categoryCode}::text, ${entry.tier}::"EquipmentTierKind"
  )`);
  if (values.length > 0) {
    await prisma.$executeRaw`
      UPDATE "Equipment" AS e
      SET "categoryCode" = v.category_code, "tier" = v.tier
      FROM (VALUES ${Prisma.join(values)}) AS v(id, category_code, tier)
      WHERE e.id = v.id
    `;
  }

  const anomalies = matched
    .filter(({ entry }) => !obtainableTiers.has(entry.tier))
    .map(({ name, entry }) => ({ name, tier: entry.tier }));

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
