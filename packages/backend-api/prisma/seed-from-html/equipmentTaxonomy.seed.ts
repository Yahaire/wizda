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
  /** Enriched/created items that got no category (source lacked, or we couldn't map, a weight class). */
  withoutCategory: string[],
  /** Enriched/created items the source gave no usable rank for (blank, or a rank we don't know). */
  withoutRank: string[],
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
    // `rank` is COALESCEd, `categoryCode` is not, and the asymmetry is deliberate.
    // A null rank here means "the source didn't tell us this time" (blank column,
    // or a label we no longer recognise) — never "this item has no rank". Plain-
    // SETting it would mean a single upstream rename ("Ebonsteel" -> "Ebon Steel")
    // silently clears the rank on every Ebonsteel item at once, which is exactly
    // the catalogue-wide blast radius this pass was reworked to avoid. Category
    // has no such failure mode: nulling it is the intended outcome for an item we
    // can't place, and the previous value would be just as wrong.
    await prisma.$executeRaw`
      UPDATE "Equipment" AS e
      SET "categoryCode" = v.category_code, "rank" = COALESCE(v.rank, e."rank")
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

  // A null rank isn't an anomaly, it's an absence — it's reported via
  // `withoutRank` instead, and the UPDATE above left the previous value in place.
  const anomalies = toUpdate.flatMap(({ name, junkSourced, entry: { rank } }) => {
    if (!junkSourced || rank === null || obtainableRanks.has(rank)) {
      return [];
    }
    return [{ name, rank }];
  });

  const sortedNames = (
    entries: readonly { name: string, entry: EquipmentTaxonomyEntry }[],
    isMissing: (entry: EquipmentTaxonomyEntry) => boolean,
  ): string[] => entries
    .filter(({ entry }) => isMissing(entry))
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right));

  const enriched = [...toUpdate, ...toCreate];

  return {
    totalTaxonomyEntries: taxonomyByName.size,
    updated: toUpdate.length,
    created: toCreate.length,
    withoutCategory: sortedNames(enriched, (entry) => entry.categoryCode === null),
    withoutRank: sortedNames(enriched, (entry) => entry.rank === null),
    unmatchedNames,
    anomalies,
  };
}
