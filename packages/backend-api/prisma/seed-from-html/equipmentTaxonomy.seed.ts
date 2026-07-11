import { Prisma, PrismaClient } from '@local-prisma/generated/client';
import { EquipmentRankKind } from '@shared/domain/rank';

import { EquipmentTaxonomyEntry } from './equipmentTaxonomy.mapping';

/** Outcome of the enrichment pass — surfaced by the orchestrator for logging. */
export interface SeedTaxonomyResult {
  /** Total taxonomy entries (weapon + armor) parsed from the CSVs. */
  totalTaxonomyEntries: number,
  /** Existing `Equipment` rows enriched with rank (+ category where available). */
  updated: number,
  /**
   * New `Equipment` rows created for taxonomy items the earlier seeds never saw —
   * equipment not obtainable through junk (nor with scraped blessing rates). These
   * carry only name + rank + category; they have no drop rows, so the guarantee
   * calc can't answer for them and the Oracle omits them, but they show in the
   * equipment list. See docs/domain.md.
   */
  created: number,
  /** Enriched/created items that got a rank but no category (source lacked a weight class). */
  withoutCategory: string[],
  /**
   * DB equipment names absent from the CSVs (name drift or genuinely absent) —
   * these keep whatever enrichment they already had.
   */
  unmatchedNames: string[],
  /**
   * Junk-sourced items whose CSV rank is NOT junk-obtainable — a data anomaly
   * (expected empty; only "Worn" is non-junk, and it shouldn't drop from junk).
   * Restricted to items that actually have junk drop rows: a newly-created,
   * junk-less item legitimately being "Worn" is normal, not an anomaly.
   */
  anomalies: { name: string, rank: EquipmentRankKind }[],
}

/**
 * Reconciles our `Equipment` catalog against the Fasterthoughts taxonomy, matched
 * by exact name: enriches existing rows with `categoryCode` + `rank`, and
 * **creates** rows for taxonomy items no earlier seed produced (equipment not
 * obtainable through junk). Existing rows are updated with one bulk
 * `UPDATE ... FROM (VALUES ...)` keyed by id (mirroring the maxDrop update in
 * `seedDropRatesByJunk`); new rows go in via `createMany`. Returns update/create/
 * anomaly stats for the caller to log.
 */
export async function seedEquipmentTaxonomy(
  prisma: PrismaClient,
  taxonomyByName: Map<string, EquipmentTaxonomyEntry>,
  obtainableRanks: ReadonlySet<EquipmentRankKind>,
): Promise<SeedTaxonomyResult> {
  const existing = await prisma.equipment.findMany({
    select: { id: true, name: true, _count: { select: { dropRates: true } } },
  });
  const existingByName = new Map(existing.map((item) => [item.name, item]));

  const toUpdate: {
    id: string,
    name: string,
    junkSourced: boolean,
    entry: EquipmentTaxonomyEntry,
  }[] = [];
  const toCreate: { name: string, entry: EquipmentTaxonomyEntry }[] = [];
  for (const [name, entry] of taxonomyByName) {
    const row = existingByName.get(name);
    if (row) {
      toUpdate.push({ id: row.id, name, junkSourced: row._count.dropRates > 0, entry });
    } else {
      toCreate.push({ name, entry });
    }
  }

  if (toUpdate.length > 0) {
    const values = toUpdate.map(({ id, entry }) => Prisma.sql`(
      ${id}::text, ${entry.categoryCode}::text, ${entry.rank}::"EquipmentRankKind"
    )`);
    await prisma.$executeRaw`
      UPDATE "Equipment" AS e
      SET "categoryCode" = v.category_code, "rank" = v.rank
      FROM (VALUES ${Prisma.join(values)}) AS v(id, category_code, rank)
      WHERE e.id = v.id
    `;
  }

  if (toCreate.length > 0) {
    await prisma.equipment.createMany({
      data: toCreate.map(({ name, entry }) => ({
        name,
        categoryCode: entry.categoryCode,
        rank: entry.rank,
      })),
      skipDuplicates: true,
    });
  }

  const unmatchedNames = existing
    .filter((item) => !taxonomyByName.has(item.name))
    .map((item) => item.name)
    .sort((left, right) => left.localeCompare(right));

  const anomalies = toUpdate
    .filter(({ junkSourced, entry }) => junkSourced && !obtainableRanks.has(entry.rank))
    .map(({ name, entry }) => ({ name, rank: entry.rank }));

  const withoutCategory = [...toUpdate, ...toCreate]
    .filter(({ entry }) => entry.categoryCode === null)
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right));

  return {
    totalTaxonomyEntries: taxonomyByName.size,
    updated: toUpdate.length,
    created: toCreate.length,
    withoutCategory,
    unmatchedNames,
    anomalies,
  };
}
