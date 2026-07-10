/**
 * Equipment rank — static reference data.
 *
 * The base strength band tied to a material. The game calls this an item's
 * "Rank" (some players also say "Tier"); it is NOT the adventurer rank — a
 * different, character-level concept the game also labels "Rank". See
 * docs/domain.md. Mirrors the Prisma `EquipmentRankKind` enum in schema.prisma
 * (keep the two in sync) and seeds the `EquipmentRank` table.
 *
 * `orderIndex` (not enum order) is the authoritative strength ordering, so it
 * never depends on how the DB stores the enum. The progression is
 * Worn → Bronze → Iron → Steel → Ebonsteel → Silver.
 *
 * Rank is enrichment: a nullable column on `Equipment` (not always derivable
 * from an item's name) and isn't required by the core "how much junk?" calc.
 * This catalog powers the frontend's rank filter, rank icons, and display.
 */

/** The equipment ranks. Mirror of the Prisma `EquipmentRankKind` enum. */
export enum EquipmentRankKind {
  WORN = 'WORN',
  BRONZE = 'BRONZE',
  IRON = 'IRON',
  STEEL = 'STEEL',
  EBONSTEEL = 'EBONSTEEL',
  SILVER = 'SILVER',
}

export interface EquipmentRankInfo {
  kind: EquipmentRankKind,
  /** Display name, e.g. "Ebonsteel". */
  name: string,
  /** Authoritative strength ordering (ascending). */
  orderIndex: number,
  /**
   * Whether items of this rank can be obtained by reversing junk. Only `Worn`
   * cannot — the other five all drop. Forward-looking for the non-junk equipment
   * work, and a validation aid: a junk-sourced item enriched to a non-obtainable
   * rank is a data anomaly.
   */
  isObtainableThroughJunk: boolean,
  /**
   * Display colour for the rank icon, approximating the in-game tint. Several
   * ranks are gray/near-white shades, so icons need an outline for contrast (see
   * the web-client rank icon).
   */
  color: string,
}

/** The ranks in ascending strength order. Seeds the `EquipmentRank` table. */
export const EQUIPMENT_RANKS: readonly EquipmentRankInfo[] = [
  {
    kind: EquipmentRankKind.WORN,
    name: 'Worn',
    orderIndex: 1,
    isObtainableThroughJunk: false,
    color: '#9ea4a9',
  },
  {
    kind: EquipmentRankKind.BRONZE,
    name: 'Bronze',
    orderIndex: 2,
    isObtainableThroughJunk: true,
    color: '#d68b3c',
  },
  {
    kind: EquipmentRankKind.IRON,
    name: 'Iron',
    orderIndex: 3,
    isObtainableThroughJunk: true,
    color: '#c1bdc2',
  },
  {
    kind: EquipmentRankKind.STEEL,
    name: 'Steel',
    orderIndex: 4,
    isObtainableThroughJunk: true,
    color: '#6fb0e0',
  },
  {
    kind: EquipmentRankKind.EBONSTEEL,
    name: 'Ebonsteel',
    orderIndex: 5,
    isObtainableThroughJunk: true,
    color: '#4a5266',
  },
  {
    kind: EquipmentRankKind.SILVER,
    name: 'Silver',
    orderIndex: 6,
    isObtainableThroughJunk: true,
    color: '#e9ebee',
  },
];
