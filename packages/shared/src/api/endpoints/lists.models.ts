/**
 * Response models for the reference-list endpoints (`GET /junks`,
 * `GET /equipment`). These feed the frontend's filter selects — notably the
 * valid equipment/junk names that the guarantee endpoints expect as input.
 */

import { GearTier } from '../../domain/tier';

/** One entry of `GET /junks`. */
export interface JunkListItem {
  name: string,
  /** See `Junk.hasMultiplePools` — a frontend caveat flag. */
  hasMultiplePools: boolean,
  /** Highest quality (★1–5) any equipment drops from this junk; null if unknown. */
  maxDropQuality: number | null,
  /** Highest grade (1–5) any equipment drops from this junk; null if unknown. */
  maxDropGrade: number | null,
}

/** A junk that a piece of equipment can drop from. */
export interface EquipmentJunkSource {
  junkName: string,
  /**
   * Highest quality (★1–5) this equipment drops at *from this specific junk* —
   * distinct from `EquipmentListItem.maxDropQuality`, which is the piece's best
   * across every junk. Null if unknown.
   */
  maxDropQuality: number | null,
  /** Highest grade (1–5) this equipment drops at *from this specific junk*; null if unknown. */
  maxDropGrade: number | null,
}

/**
 * The equipment category a piece belongs to (e.g. "Two-Handed Axe"). Mirrors an
 * `EquipmentCategory` reference row. Groundwork: the backend does not yet map
 * items to categories, so `EquipmentListItem.category` is currently always null.
 */
export interface EquipmentCategoryRef {
  /** Stable code, e.g. "TWO_HANDED_AXE". */
  code: string,
  /** Display name, e.g. "Two-Handed Axe". */
  name: string,
}

/** One entry of `GET /equipment`. */
export interface EquipmentListItem {
  name: string,
  /** Category, or null when it hasn't been mapped yet (not seeded — see routes). */
  category: EquipmentCategoryRef | null,
  /** Gear tier, or null when it couldn't be derived (enrichment — see schema). */
  tier: GearTier | null,
  /** Highest quality (★1–5) this equipment is known to drop at; null if unknown. */
  maxDropQuality: number | null,
  /** Highest grade (1–5) this equipment is known to drop at; null if unknown. */
  maxDropGrade: number | null,
  /** Distinct junks this equipment drops from, sorted by name. */
  sources: EquipmentJunkSource[],
}
