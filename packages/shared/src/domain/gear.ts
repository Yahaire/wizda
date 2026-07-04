/**
 * Gear taxonomy — static reference data.
 *
 * Single source of truth for the values seeded into the DB's `GearType` and
 * `EquipmentCategory` tables (see packages/backend-api/prisma/schema.prisma).
 * The Prisma `GearTypeKind` enum mirrors {@link GearTypeKind} here; the seed
 * reads {@link GEAR_TYPES} and {@link EQUIPMENT_CATEGORIES}.
 */

/** The 7 broad gear types. */
export enum GearTypeKind {
  WEAPON = 'WEAPON',
  SHIELD = 'SHIELD',
  HELMET = 'HELMET',
  GLOVES = 'GLOVES',
  CHEST_ARMOR = 'CHEST_ARMOR',
  BOOTS = 'BOOTS',
  ACCESSORY = 'ACCESSORY',
}

export interface GearTypeInfo {
  kind: GearTypeKind,
  name: string,
}

/** The broad gear types, in display order. Seeds the `GearType` table. */
export const GEAR_TYPES: readonly GearTypeInfo[] = [
  {
    kind: GearTypeKind.WEAPON,
    name: 'Weapons',
  },
  {
    kind: GearTypeKind.SHIELD,
    name: 'Shields',
  },
  {
    kind: GearTypeKind.HELMET,
    name: 'Helmets',
  },
  {
    kind: GearTypeKind.GLOVES,
    name: 'Gloves',
  },
  {
    kind: GearTypeKind.CHEST_ARMOR,
    name: 'Chest Armor',
  },
  {
    kind: GearTypeKind.BOOTS,
    name: 'Boots',
  },
  {
    kind: GearTypeKind.ACCESSORY,
    name: 'Accessories',
  },
];

export interface EquipmentCategoryInfo {
  /** Readable code, e.g. "TWO_HANDED_AXE". Stable — decoupled from `name`. */
  code: string,
  name: string,
  gearType: GearTypeKind,
}

/**
 * Equipment categories within each gear type. Seeds the `EquipmentCategory`
 * table. Codes are explicit (not derived from `name`) so renaming a display
 * name never changes a primary key.
 */
export const EQUIPMENT_CATEGORIES: readonly EquipmentCategoryInfo[] = [
  // Weapons
  {
    code: 'DAGGER',
    name: 'Dagger',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_SWORD',
    name: 'One-Handed Sword',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_AXE',
    name: 'One-Handed Axe',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_STAFF',
    name: 'One-Handed Staff',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'ONE_HANDED_BLUNT_WEAPON',
    name: 'One-Handed Blunt Weapon',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'THROWING_NINJA_TOOL',
    name: 'Throwing Ninja Tool',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'NINJATO',
    name: 'Ninjato',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'KATANA',
    name: 'Katana',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_SWORD',
    name: 'Two-Handed Sword',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_AXE',
    name: 'Two-Handed Axe',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_STAFF',
    name: 'Two-Handed Staff',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'TWO_HANDED_BLUNT_WEAPON',
    name: 'Two-Handed Blunt Weapon',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'BOW',
    name: 'Bow',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'ODACHI',
    name: 'Odachi',
    gearType: GearTypeKind.WEAPON,
  },
  {
    code: 'TOOLS',
    name: 'Tools',
    gearType: GearTypeKind.WEAPON,
  },

  // Shields
  {
    code: 'SMALL_SHIELD',
    name: 'Small Shield',
    gearType: GearTypeKind.SHIELD,
  },
  {
    code: 'LIGHT_SHIELD',
    name: 'Light Shield',
    gearType: GearTypeKind.SHIELD,
  },
  {
    code: 'HEAVY_SHIELD',
    name: 'Heavy Shield',
    gearType: GearTypeKind.SHIELD,
  },

  // Helmets
  {
    code: 'HAT',
    name: 'Hat',
    gearType: GearTypeKind.HELMET,
  },
  {
    code: 'LIGHT_HELMET',
    name: 'Light Helmet',
    gearType: GearTypeKind.HELMET,
  },
  {
    code: 'HEAVY_HELMET',
    name: 'Heavy Helmet',
    gearType: GearTypeKind.HELMET,
  },

  // Gloves
  {
    code: 'GLOVES',
    name: 'Gloves',
    gearType: GearTypeKind.GLOVES,
  },
  {
    code: 'LIGHT_GAUNTLETS',
    name: 'Light Gauntlets',
    gearType: GearTypeKind.GLOVES,
  },
  {
    code: 'HEAVY_GAUNTLETS',
    name: 'Heavy Gauntlets',
    gearType: GearTypeKind.GLOVES,
  },

  // Chest armor
  {
    code: 'CLOTHES',
    name: 'Clothes',
    gearType: GearTypeKind.CHEST_ARMOR,
  },
  {
    code: 'LIGHT_ARMOR',
    name: 'Light Armor',
    gearType: GearTypeKind.CHEST_ARMOR,
  },
  {
    code: 'HEAVY_ARMOR',
    name: 'Heavy Armor',
    gearType: GearTypeKind.CHEST_ARMOR,
  },

  // Boots
  {
    code: 'SHOES',
    name: 'Shoes',
    gearType: GearTypeKind.BOOTS,
  },
  {
    code: 'LIGHT_ARMOR_BOOTS',
    name: 'Light Armor Boots',
    gearType: GearTypeKind.BOOTS,
  },
  {
    code: 'HEAVY_ARMOR_BOOTS',
    name: 'Heavy Armor Boots',
    gearType: GearTypeKind.BOOTS,
  },

  // Accessories
  {
    code: 'ACCESSORIES',
    name: 'Accessories',
    gearType: GearTypeKind.ACCESSORY,
  },
];
