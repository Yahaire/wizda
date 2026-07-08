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
}

/** One entry of `GET /equipment`. */
export interface EquipmentListItem {
  name: string,
  /** Gear tier, or null when it couldn't be derived (enrichment — see schema). */
  tier: GearTier | null,
  /** Highest quality (★1–5) this equipment is known to drop at; null if unknown. */
  maxDropQuality: number | null,
  /** Highest grade (1–5) this equipment is known to drop at; null if unknown. */
  maxDropGrade: number | null,
  /** Distinct junks this equipment drops from, sorted by name. */
  sources: EquipmentJunkSource[],
}
