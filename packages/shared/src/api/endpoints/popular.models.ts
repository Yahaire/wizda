/**
 * Response model for `GET /popular` — the aggregated Junk Oracle "most
 * searched" data, read from `PopularJunkOracleQuery`(+`Term`) (see
 * schema.prisma and docs/analytics.md). Distinct from the Umami
 * `guarantee_query` event, which stores only counts, never which items were
 * picked.
 */

import { GuaranteeFilters } from './junkToGuarantee.models';

/**
 * One of the top whole-query combos. Ordered by how often it's been searched, but
 * the tally itself is deliberately not exposed — how busy the site is, is nobody's
 * business but ours. The order is the only signal a player needs.
 */
export interface PopularQueryEntry {
  /** The accepted-outcome filters of this combo (see `GuaranteeFilters`). */
  filters: GuaranteeFilters,
}

/** The filter axes a popular term can belong to (mirrors `GuaranteeFilters`). */
export type PopularTermKind = 'equipment' | 'blessing' | 'rank' | 'category' | 'quality' | 'grade';

/** Response of `GET /popular`. */
export interface PopularResult {
  /** Top whole-query combos, most-searched first. */
  queries: PopularQueryEntry[],
  /**
   * Top items per axis, most-searched first within each axis — each a stable public
   * key (equipment name, blessing/category code, rank kind, or a stringified
   * quality/grade level).
   *
   * Bare keys, in order: like {@link PopularQueryEntry}, the counts that rank these
   * stay in the database. Position carries the popularity; the tally would only tell
   * a reader how busy the site is.
   */
  terms: Record<PopularTermKind, string[]>,
}
