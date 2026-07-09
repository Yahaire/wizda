/**
 * Equipment tier — static reference data.
 *
 * The base strength band tied to a material. Mirrors the Prisma
 * `EquipmentTierKind` enum in schema.prisma (keep the two in sync). Declared
 * ascending, so array/enum order = strength rank (bronze weakest, silver
 * strongest).
 *
 * Tier is enrichment: it's a nullable column on `Equipment` (not always
 * derivable from an item's name) and isn't required by the core "how much junk?"
 * calc. This catalog powers the frontend's tier filter and display.
 */

/** The equipment tiers. Mirror of the Prisma `EquipmentTierKind` enum. */
export enum EquipmentTierKind {
  BRONZE = 'BRONZE',
  STEEL = 'STEEL',
  EBONSTEEL = 'EBONSTEEL',
  SILVER = 'SILVER',
}

export interface EquipmentTierInfo {
  kind: EquipmentTierKind,
  /** Display name. */
  name: string,
}

/** The tiers in ascending strength order. Seeds no table (mirror only). */
export const EQUIPMENT_TIERS: readonly EquipmentTierInfo[] = [
  {
    kind: EquipmentTierKind.BRONZE,
    name: 'Bronze',
  },
  {
    kind: EquipmentTierKind.STEEL,
    name: 'Steel',
  },
  {
    kind: EquipmentTierKind.EBONSTEEL,
    name: 'Ebonsteel',
  },
  {
    kind: EquipmentTierKind.SILVER,
    name: 'Silver',
  },
];
