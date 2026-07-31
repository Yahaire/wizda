import { EquipmentRankKind } from '@shared/domain/rank';

import type { CsvRow } from './loadCsv';

/**
 * Pure mappings from the Fasterthoughts CSV taxonomy columns to our own
 * `EquipmentCategory` codes and `EquipmentRankKind` ranks, plus the builder that
 * turns parsed CSV rows into a `name -> { categoryCode, rank }` lookup. Kept free
 * of I/O and Prisma so it's unit-testable (see the sibling `.test.ts`).
 *
 * Unknown source values are **recorded, not thrown**: an unrecognised Type/Rank
 * yields `null` for that one field and lands in {@link TaxonomyDrift}, which the
 * orchestrator prints as an ACTION REQUIRED block. This used to throw, on the
 * reasoning that loud drift beats silently mis-tagged items — still true, but the
 * throw fired mid-seed *after* the drop-rate writes had committed, so one new
 * weapon type both blocked enrichment for the whole catalogue and (via
 * `scripts/seed-with-maintenance.mjs`, which holds `.maintenance` on any non-zero
 * exit) took the site down until a human re-ran it. Nothing is mis-tagged now
 * either — an unmapped item simply has no category, which every display path
 * already handles. See docs/domain.md's "Adding a new equipment category".
 */

/** CSV header names we read (weapon + armor share most; armor adds "Armor Type"). */
const NAME_COLUMN = 'Item Name';
const TYPE_COLUMN = 'Type';
const RANK_COLUMN = 'Rank';
const ARMOR_TYPE_COLUMN = 'Armor Type';

/**
 * The item's derived category + rank. Both are nullable, for two different
 * reasons that happen to share a representation:
 * - *blank* source field — the source occasionally omits an item's weight class
 *   (e.g. a couple of gloves with a blank Armor Type). Routine, not drift.
 * - *unrecognised* source value — real drift (a new weapon type, a renamed
 *   rank). Also recorded in {@link TaxonomyDrift} so it gets reported.
 *
 * A null `rank` means "the source didn't tell us this time", never "this item
 * has no rank" — see the `COALESCE` in `equipmentTaxonomy.seed.ts`.
 */
export interface EquipmentTaxonomyEntry {
  categoryCode: string | null,
  rank: EquipmentRankKind | null,
}

/**
 * Unrecognised source values seen while building the taxonomy, deduplicated and
 * sorted. Non-empty means the upstream CSVs have drifted from our mappings and
 * someone needs to work through the runbook; the seed itself still completes.
 */
export interface TaxonomyDrift {
  /** Unknown weapon `Type` values, e.g. "Polearm". */
  weaponTypes: string[],
  /** Unknown *outer* armor `Type` values (a new gear slot), e.g. "Cape". */
  armorTypes: string[],
  /** Known armor `Type` with an unknown weight class, formatted "Head / Plated". */
  armorWeightClasses: string[],
  /** Unknown `Rank` values, e.g. a renamed "Ebon Steel". */
  ranks: string[],
}

/** Whether any drift at all was recorded — the trigger for the ACTION REQUIRED report. */
export function hasTaxonomyDrift(drift: TaxonomyDrift): boolean {
  return (
    drift.weaponTypes.length > 0
    || drift.armorTypes.length > 0
    || drift.armorWeightClasses.length > 0
    || drift.ranks.length > 0
  );
}

/** What {@link buildTaxonomyByName} returns: the lookup, plus what it couldn't map. */
export interface TaxonomyBuildResult {
  byName: Map<string, EquipmentTaxonomyEntry>,
  drift: TaxonomyDrift,
}

/**
 * CSV `Rank` -> our rank. Covers all 6 ranks the source uses. Note: some rows
 * carry an "Ex." marker, but it lives in the `Compendium Number` column, not
 * `Rank` — those items still have a normal `Rank` (e.g. Silver, Ebonsteel).
 * There is no separate "Ex" rank.
 */
export const RANK_TO_KIND: Readonly<Record<string, EquipmentRankKind>> = {
  Worn: EquipmentRankKind.WORN,
  Bronze: EquipmentRankKind.BRONZE,
  Iron: EquipmentRankKind.IRON,
  Steel: EquipmentRankKind.STEEL,
  Ebonsteel: EquipmentRankKind.EBONSTEEL,
  Silver: EquipmentRankKind.SILVER,
};

/** Weapon CSV `Type` -> our category code. */
export const WEAPON_TYPE_TO_CATEGORY: Readonly<Record<string, string>> = {
  Dagger: 'DAGGER',
  '1H_Sword': 'ONE_HANDED_SWORD',
  '2H_Sword': 'TWO_HANDED_SWORD',
  '1H_Axe': 'ONE_HANDED_AXE',
  '2H_Axe': 'TWO_HANDED_AXE',
  '1H_Mace': 'ONE_HANDED_BLUNT_WEAPON',
  '2H_Mace': 'TWO_HANDED_BLUNT_WEAPON',
  '2H_Spear': 'TWO_HANDED_SPEAR',
  '1H_Staff': 'ONE_HANDED_STAFF',
  '2H_Staff': 'TWO_HANDED_STAFF',
  Bow: 'BOW',
  Sam_Katana: 'KATANA',
  Sam_Odachi: 'ODACHI',
  Cesti: 'CESTI',
  Ninjato: 'NINJATO',
  Ninja_Throw: 'THROWING_NINJA_TOOL',
  Tool: 'TOOLS',
};

/**
 * Armor CSV `(Type, Armor Type)` -> our category code. The pair is needed
 * because e.g. a "Head" piece is a Hat / Light Helmet / Heavy Helmet depending on
 * its weight class. Shields use Cloth/Light/Heavy for Small/Light/Heavy.
 */
export const ARMOR_TYPE_TO_CATEGORY: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Head: { Cloth: 'HAT', Light: 'LIGHT_HELMET', Heavy: 'HEAVY_HELMET' },
  Shield: { Cloth: 'SMALL_SHIELD', Light: 'LIGHT_SHIELD', Heavy: 'HEAVY_SHIELD' },
  Hands: { Cloth: 'GLOVES', Light: 'LIGHT_GAUNTLETS', Heavy: 'HEAVY_GAUNTLETS' },
  Body: { Cloth: 'CLOTHES', Light: 'LIGHT_ARMOR', Heavy: 'HEAVY_ARMOR' },
  Feet: { Cloth: 'SHOES', Light: 'LIGHT_ARMOR_BOOTS', Heavy: 'HEAVY_ARMOR_BOOTS' },
  Accessories: { Accessory: 'ACCESSORIES' },
};

/**
 * CSV item name -> the name the gacha-rate pages use, for items the two sources
 * spell differently. The taxonomy pass matches by exact name, so drift here costs
 * twice: the real (junk-sourced) row never gets its rank/category, *and* the CSV
 * name gets created as a phantom duplicate with no drop rates.
 *
 * Every entry below is the same upstream slip — a stray "the" in the CSV. It's a
 * typo rather than a naming convention: the CSV's own "Cloak of Light Spirit" and
 * "Light Spirit Amulet", from the same block, omit it and match fine. We alias
 * toward the gacha-rate spelling because that's what the junk tables (and so the
 * whole site) show.
 */
export const CSV_NAME_ALIASES: Readonly<Record<string, string>> = {
  'Headcloth of the Light Spirit': 'Headcloth of Light Spirit',
  'Helm of the Light Spirit': 'Helm of Light Spirit',
  'Heavy Helm of the Light Spirit': 'Heavy Helm of Light Spirit',
  'Mail of the Light Spirit': 'Mail of Light Spirit',
  'Heavy Mail of the Light Spirit': 'Heavy Mail of Light Spirit',
};

/** A CSV item name mapped through {@link CSV_NAME_ALIASES}; unaliased names pass through. */
export function canonicalName(csvName: string): string {
  return CSV_NAME_ALIASES[csvName] ?? csvName;
}

/** CSV `Rank` label -> our rank kind; null when blank or unrecognised. */
export function getRankKind(rank: string): EquipmentRankKind | null {
  return RANK_TO_KIND[rank] ?? null;
}

/** Weapon `Type` -> category code; null when blank or unrecognised. */
export function getWeaponCategoryCode(type: string): string | null {
  return WEAPON_TYPE_TO_CATEGORY[type] ?? null;
}

/** Armor `(Type, Armor Type)` -> category code; null when either is blank or unrecognised. */
export function getArmorCategoryCode(type: string, armorType: string): string | null {
  return ARMOR_TYPE_TO_CATEGORY[type]?.[armorType] ?? null;
}

/** Whether the outer armor `Type` is a gear slot we know at all (vs. a new one). */
export function isKnownArmorType(type: string): boolean {
  return type in ARMOR_TYPE_TO_CATEGORY;
}

/** Sorted, deduplicated — so 50 rows carrying the same new Type report once. */
function toSortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/**
 * Build the `name -> { categoryCode, rank }` lookup from parsed weapon + armor
 * CSV rows, keyed by the gacha-rate spelling (see {@link CSV_NAME_ALIASES}). Rows
 * without an item name (blank separator lines) are skipped. A name appearing twice
 * keeps the last occurrence.
 *
 * Every row yields an entry, even one whose Type/Rank we don't recognise — that
 * item is still worth storing with whatever we *could* derive. What we couldn't
 * map comes back in {@link TaxonomyBuildResult.drift}.
 */
export function buildTaxonomyByName(
  weaponRows: readonly CsvRow[],
  armorRows: readonly CsvRow[],
): TaxonomyBuildResult {
  const byName = new Map<string, EquipmentTaxonomyEntry>();
  const unknownWeaponTypes: string[] = [];
  const unknownArmorTypes: string[] = [];
  const unknownArmorWeightClasses: string[] = [];
  const unknownRanks: string[] = [];

  // A blank field is a routine source gap, not drift — only a non-empty value we
  // can't place gets recorded. Same rule for every column below.
  const resolveRank = (rank: string): EquipmentRankKind | null => {
    const kind = getRankKind(rank);
    if (!kind && rank) {
      unknownRanks.push(rank);
    }
    return kind;
  };

  for (const row of weaponRows) {
    const name = row[NAME_COLUMN]?.trim();
    if (!name) {
      continue;
    }
    const type = (row[TYPE_COLUMN] ?? '').trim();
    const categoryCode = type ? getWeaponCategoryCode(type) : null;
    if (!categoryCode && type) {
      unknownWeaponTypes.push(type);
    }
    byName.set(canonicalName(name), {
      categoryCode,
      rank: resolveRank((row[RANK_COLUMN] ?? '').trim()),
    });
  }

  for (const row of armorRows) {
    const name = row[NAME_COLUMN]?.trim();
    if (!name) {
      continue;
    }
    const type = (row[TYPE_COLUMN] ?? '').trim();
    const armorType = (row[ARMOR_TYPE_COLUMN] ?? '').trim();
    const categoryCode = type && armorType ? getArmorCategoryCode(type, armorType) : null;
    if (!categoryCode && type && armorType) {
      // Split the two, because they mean different things: an unknown outer Type
      // is a whole new gear slot (needs an `EquipmentTypeKind` migration), while
      // an unknown weight class is just one more category under a slot we have.
      if (isKnownArmorType(type)) {
        unknownArmorWeightClasses.push(`${type} / ${armorType}`);
      } else {
        unknownArmorTypes.push(type);
      }
    }
    byName.set(canonicalName(name), {
      categoryCode,
      rank: resolveRank((row[RANK_COLUMN] ?? '').trim()),
    });
  }

  return {
    byName,
    drift: {
      weaponTypes: toSortedUnique(unknownWeaponTypes),
      armorTypes: toSortedUnique(unknownArmorTypes),
      armorWeightClasses: toSortedUnique(unknownArmorWeightClasses),
      ranks: toSortedUnique(unknownRanks),
    },
  };
}
