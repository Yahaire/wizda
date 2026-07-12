/**
 * Response model for `GET /popular` — the aggregated Junk Oracle "most
 * searched" data, read from `PopularJunkOracleQuery`(+`Term`) (see
 * schema.prisma and docs/analytics.md). Distinct from the Umami
 * `guarantee_query` event, which stores only counts, never which items were
 * picked.
 */

import { GuaranteeFilters } from './junkToGuarantee.models';

/** One of the top whole-query combos, with how many times it's been searched. */
export interface PopularQueryEntry {
  /** The accepted-outcome filters of this combo (see `GuaranteeFilters`). */
  filters: GuaranteeFilters,
  /** Times this exact combo has been searched. */
  count: number,
}

/** One of the top items on a single filter axis, with its aggregate search count. */
export interface PopularTermEntry {
  /** The item's stable public key — equipment name, blessing/category code, rank
   * kind, or a stringified quality/grade level. */
  key: string,
  /** Sum of `count` across every combo that includes this item. */
  count: number,
}

/** The filter axes a `PopularTermEntry` can belong to (mirrors `GuaranteeFilters`). */
export type PopularTermKind = 'equipment' | 'blessing' | 'rank' | 'category' | 'quality' | 'grade';

/** Response of `GET /popular`. */
export interface PopularResult {
  /** Top whole-query combos, most-searched first. */
  queries: PopularQueryEntry[],
  /** Top items per axis, most-searched first within each axis. */
  terms: Record<PopularTermKind, PopularTermEntry[]>,
}
