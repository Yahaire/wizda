/**
 * Equipment tier — static reference data.
 *
 * The base strength band tied to a material (a.k.a. an item's "rank" — not to be
 * confused with adventurer rank; see docs/domain.md). Mirrors the Prisma
 * `EquipmentTierKind` enum in schema.prisma (keep the two in sync) and seeds the
 * `EquipmentTier` table.
 *
 * `orderIndex` (not enum order) is the authoritative strength ordering, so it
 * never depends on how the DB stores the enum. The progression is
 * Worn → Bronze → Iron → Steel → Ebonsteel → Silver.
 *
 * Tier is enrichment: a nullable column on `Equipment` (not always derivable
 * from an item's name) and isn't required by the core "how much junk?" calc.
 * This catalog powers the frontend's tier filter, tier icons, and display.
 */

/** The equipment tiers. Mirror of the Prisma `EquipmentTierKind` enum. */
export enum EquipmentTierKind {
  WORN = 'WORN',
  BRONZE = 'BRONZE',
  IRON = 'IRON',
  STEEL = 'STEEL',
  EBONSTEEL = 'EBONSTEEL',
  SILVER = 'SILVER',
}

export interface EquipmentTierInfo {
  kind: EquipmentTierKind,
  /** Display name, e.g. "Ebonsteel". */
  name: string,
  /** Authoritative strength ordering (ascending). */
  orderIndex: number,
  /**
   * Whether items of this tier can be obtained by reversing junk. Only `Worn`
   * cannot — the other five all drop. Forward-looking for the non-junk equipment
   * work, and a validation aid: a junk-sourced item enriched to a non-obtainable
   * tier is a data anomaly.
   */
  isObtainableThroughJunk: boolean,
  /**
   * Display colour for the tier icon, approximating the in-game tint. Several
   * tiers are gray/near-white shades, so icons need an outline for contrast (see
   * the web-client tier icon).
   */
  color: string,
}

/** The tiers in ascending strength order. Seeds the `EquipmentTier` table. */
export const EQUIPMENT_TIERS: readonly EquipmentTierInfo[] = [
  {
    kind: EquipmentTierKind.WORN,
    name: 'Worn',
    orderIndex: 1,
    isObtainableThroughJunk: false,
    color: '#9aa0a6',
  },
  {
    kind: EquipmentTierKind.BRONZE,
    name: 'Bronze',
    orderIndex: 2,
    isObtainableThroughJunk: true,
    color: '#cd7f32',
  },
  {
    kind: EquipmentTierKind.IRON,
    name: 'Iron',
    orderIndex: 3,
    isObtainableThroughJunk: true,
    color: '#6b7075',
  },
  {
    kind: EquipmentTierKind.STEEL,
    name: 'Steel',
    orderIndex: 4,
    isObtainableThroughJunk: true,
    color: '#6f9fc4',
  },
  {
    kind: EquipmentTierKind.EBONSTEEL,
    name: 'Ebonsteel',
    orderIndex: 5,
    isObtainableThroughJunk: true,
    color: '#2b2f36',
  },
  {
    kind: EquipmentTierKind.SILVER,
    name: 'Silver',
    orderIndex: 6,
    isObtainableThroughJunk: true,
    color: '#d8dce0',
  },
];
