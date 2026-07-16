import { EquipmentRankKind } from '@shared/domain/rank';

import type { CsvRow } from './loadCsv';

/**
 * Pure mappings from the Fasterthoughts CSV taxonomy columns to our own
 * `EquipmentCategory` codes and `EquipmentRankKind` ranks, plus the builder that
 * turns parsed CSV rows into a `name -> { categoryCode, rank }` lookup. Kept free
 * of I/O and Prisma so it's unit-testable (see the sibling `.test.ts`). Unknown
 * source values throw, so a new/renamed Type/Rank in the upstream data fails the
 * seed loudly instead of silently mis-tagging items.
 */

/** CSV header names we read (weapon + armor share most; armor adds "Armor Type"). */
const NAME_COLUMN = 'Item Name';
const TYPE_COLUMN = 'Type';
const RANK_COLUMN = 'Rank';
const ARMOR_TYPE_COLUMN = 'Armor Type';

/**
 * The item's derived category + rank. `categoryCode` is nullable because the
 * source occasionally omits an item's weight class (e.g. a couple of gloves with
 * a blank Armor Type) — those still get a rank, just no category. A non-empty but
 * *unrecognised* Type/Armor-Type still throws (real drift), only genuinely blank
 * fields are tolerated.
 */
export interface EquipmentTaxonomyEntry {
  categoryCode: string | null,
  rank: EquipmentRankKind,
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

/** CSV `Rank` label -> our rank kind; throws on an unrecognised rank. */
export function rankToKind(rank: string): EquipmentRankKind {
  const kind = RANK_TO_KIND[rank];
  if (!kind) {
    throw new Error(`Unknown equipment rank in taxonomy CSV: "${rank}"`);
  }
  return kind;
}

/** Weapon `Type` -> category code; throws on an unrecognised type. */
export function weaponCategoryCode(type: string): string {
  const code = WEAPON_TYPE_TO_CATEGORY[type];
  if (!code) {
    throw new Error(`Unknown weapon type in taxonomy CSV: "${type}"`);
  }
  return code;
}

/** Armor `(Type, Armor Type)` -> category code; throws on an unrecognised pair. */
export function armorCategoryCode(type: string, armorType: string): string {
  const byArmorType = ARMOR_TYPE_TO_CATEGORY[type];
  if (!byArmorType) {
    throw new Error(`Unknown armor Type in taxonomy CSV: "${type}"`);
  }
  const code = byArmorType[armorType];
  if (!code) {
    throw new Error(`Unknown Armor Type "${armorType}" for Type "${type}" in taxonomy CSV`);
  }
  return code;
}

/**
 * Build the `name -> { categoryCode, rank }` lookup from parsed weapon + armor
 * CSV rows, keyed by the gacha-rate spelling (see {@link CSV_NAME_ALIASES}). Rows
 * without an item name (blank separator lines) are skipped. A name appearing twice
 * keeps the last occurrence.
 */
export function buildTaxonomyByName(
  weaponRows: readonly CsvRow[],
  armorRows: readonly CsvRow[],
): Map<string, EquipmentTaxonomyEntry> {
  const byName = new Map<string, EquipmentTaxonomyEntry>();

  for (const row of weaponRows) {
    const name = row[NAME_COLUMN]?.trim();
    if (!name) {
      continue;
    }
    const type = (row[TYPE_COLUMN] ?? '').trim();
    byName.set(canonicalName(name), {
      categoryCode: type ? weaponCategoryCode(type) : null,
      rank: rankToKind((row[RANK_COLUMN] ?? '').trim()),
    });
  }

  for (const row of armorRows) {
    const name = row[NAME_COLUMN]?.trim();
    if (!name) {
      continue;
    }
    const type = (row[TYPE_COLUMN] ?? '').trim();
    const armorType = (row[ARMOR_TYPE_COLUMN] ?? '').trim();
    byName.set(canonicalName(name), {
      categoryCode: type && armorType ? armorCategoryCode(type, armorType) : null,
      rank: rankToKind((row[RANK_COLUMN] ?? '').trim()),
    });
  }

  return byName;
}
