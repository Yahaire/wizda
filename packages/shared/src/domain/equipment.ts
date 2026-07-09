/**
 * Equipment taxonomy — static reference data.
 *
 * Single source of truth for the values seeded into the DB's `EquipmentType` and
 * `EquipmentCategory` tables (see packages/backend-api/prisma/schema.prisma).
 * The Prisma `EquipmentTypeKind` enum mirrors {@link EquipmentTypeKind} here; the
 * seed reads {@link EQUIPMENT_TYPES} and {@link EQUIPMENT_CATEGORIES}.
 */

/** The 7 broad equipment types. */
export enum EquipmentTypeKind {
  WEAPON = 'WEAPON',
  SHIELD = 'SHIELD',
  HELMET = 'HELMET',
  GLOVES = 'GLOVES',
  CHEST_ARMOR = 'CHEST_ARMOR',
  BOOTS = 'BOOTS',
  ACCESSORY = 'ACCESSORY',
}

export interface EquipmentTypeInfo {
  kind: EquipmentTypeKind,
  name: string,
}

/** The broad equipment types, in display order. Seeds the `EquipmentType` table. */
export const EQUIPMENT_TYPES: readonly EquipmentTypeInfo[] = [
  {
    kind: EquipmentTypeKind.WEAPON,
    name: 'Weapons',
  },
  {
    kind: EquipmentTypeKind.SHIELD,
    name: 'Shields',
  },
  {
    kind: EquipmentTypeKind.HELMET,
    name: 'Helmets',
  },
  {
    kind: EquipmentTypeKind.GLOVES,
    name: 'Gloves',
  },
  {
    kind: EquipmentTypeKind.CHEST_ARMOR,
    name: 'Chest Armor',
  },
  {
    kind: EquipmentTypeKind.BOOTS,
    name: 'Boots',
  },
  {
    kind: EquipmentTypeKind.ACCESSORY,
    name: 'Accessories',
  },
];

export interface EquipmentCategoryInfo {
  /** Readable code, e.g. "TWO_HANDED_AXE". Stable — decoupled from `name`. */
  code: string,
  name: string,
  equipmentType: EquipmentTypeKind,
}

/**
 * Equipment categories within each equipment type. Seeds the `EquipmentCategory`
 * table. Codes are explicit (not derived from `name`) so renaming a display
 * name never changes a primary key.
 */
export const EQUIPMENT_CATEGORIES: readonly EquipmentCategoryInfo[] = [
  // Weapons
  {
    code: 'DAGGER',
    name: 'Dagger',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_SWORD',
    name: 'One-Handed Sword',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_AXE',
    name: 'One-Handed Axe',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_STAFF',
    name: 'One-Handed Staff',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_BLUNT_WEAPON',
    name: 'One-Handed Blunt Weapon',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'THROWING_NINJA_TOOL',
    name: 'Throwing Ninja Tool',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'NINJATO',
    name: 'Ninjato',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'KATANA',
    name: 'Katana',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_SWORD',
    name: 'Two-Handed Sword',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_AXE',
    name: 'Two-Handed Axe',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_STAFF',
    name: 'Two-Handed Staff',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_BLUNT_WEAPON',
    name: 'Two-Handed Blunt Weapon',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'BOW',
    name: 'Bow',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'ODACHI',
    name: 'Odachi',
    equipmentType: EquipmentTypeKind.WEAPON,
  },
  {
    code: 'TOOLS',
    name: 'Tools',
    equipmentType: EquipmentTypeKind.WEAPON,
  },

  // Shields
  {
    code: 'SMALL_SHIELD',
    name: 'Small Shield',
    equipmentType: EquipmentTypeKind.SHIELD,
  },
  {
    code: 'LIGHT_SHIELD',
    name: 'Light Shield',
    equipmentType: EquipmentTypeKind.SHIELD,
  },
  {
    code: 'HEAVY_SHIELD',
    name: 'Heavy Shield',
    equipmentType: EquipmentTypeKind.SHIELD,
  },

  // Helmets
  {
    code: 'HAT',
    name: 'Hat',
    equipmentType: EquipmentTypeKind.HELMET,
  },
  {
    code: 'LIGHT_HELMET',
    name: 'Light Helmet',
    equipmentType: EquipmentTypeKind.HELMET,
  },
  {
    code: 'HEAVY_HELMET',
    name: 'Heavy Helmet',
    equipmentType: EquipmentTypeKind.HELMET,
  },

  // Gloves
  {
    code: 'GLOVES',
    name: 'Gloves',
    equipmentType: EquipmentTypeKind.GLOVES,
  },
  {
    code: 'LIGHT_GAUNTLETS',
    name: 'Light Gauntlets',
    equipmentType: EquipmentTypeKind.GLOVES,
  },
  {
    code: 'HEAVY_GAUNTLETS',
    name: 'Heavy Gauntlets',
    equipmentType: EquipmentTypeKind.GLOVES,
  },

  // Chest armor
  {
    code: 'CLOTHES',
    name: 'Clothes',
    equipmentType: EquipmentTypeKind.CHEST_ARMOR,
  },
  {
    code: 'LIGHT_ARMOR',
    name: 'Light Armor',
    equipmentType: EquipmentTypeKind.CHEST_ARMOR,
  },
  {
    code: 'HEAVY_ARMOR',
    name: 'Heavy Armor',
    equipmentType: EquipmentTypeKind.CHEST_ARMOR,
  },

  // Boots
  {
    code: 'SHOES',
    name: 'Shoes',
    equipmentType: EquipmentTypeKind.BOOTS,
  },
  {
    code: 'LIGHT_ARMOR_BOOTS',
    name: 'Light Armor Boots',
    equipmentType: EquipmentTypeKind.BOOTS,
  },
  {
    code: 'HEAVY_ARMOR_BOOTS',
    name: 'Heavy Armor Boots',
    equipmentType: EquipmentTypeKind.BOOTS,
  },

  // Accessories
  {
    code: 'ACCESSORIES',
    name: 'Accessories',
    equipmentType: EquipmentTypeKind.ACCESSORY,
  },
];
