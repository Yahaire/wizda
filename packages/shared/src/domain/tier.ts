/**
 * Gear tier — static reference data.
 *
 * The base strength band tied to a material. Mirrors the Prisma `GearTier` enum
 * in schema.prisma (keep the two in sync). Declared ascending, so array/enum
 * order = strength rank (bronze weakest, silver strongest).
 *
 * Tier is enrichment: it's a nullable column on `Equipment` (not always
 * derivable from an item's name) and isn't required by the core "how much junk?"
 * calc. This catalog powers the frontend's tier filter and display.
 */

/** The gear tiers. Mirror of the Prisma `GearTier` enum. */
export enum GearTier {
  BRONZE = 'BRONZE',
  STEEL = 'STEEL',
  EBONSTEEL = 'EBONSTEEL',
  SILVER = 'SILVER',
}

export interface GearTierInfo {
  kind: GearTier,
  /** Display name. */
  name: string,
}

/** The tiers in ascending strength order. Seeds no table (mirror only). */
export const GEAR_TIERS: readonly GearTierInfo[] = [
  {
    kind: GearTier.BRONZE,
    name: 'Bronze',
  },
  {
    kind: GearTier.STEEL,
    name: 'Steel',
  },
  {
    kind: GearTier.EBONSTEEL,
    name: 'Ebonsteel',
  },
  {
    kind: GearTier.SILVER,
    name: 'Silver',
  },
];
