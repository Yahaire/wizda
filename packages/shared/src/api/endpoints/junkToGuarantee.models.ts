/**
 * Request/response contract for the "how much junk to guarantee item X?"
 * endpoints. Pure types shared by the backend (which produces them) and the
 * web-client (which consumes them). The math behind the numbers is in
 * `packages/shared/src/domain/dropRateMath.ts`; see `docs/calculation.md`.
 */

import { TsUtilities } from '../../tsUtilities';

/** Default target confidence when a query omits `certainty` (99%). */
export const DEFAULT_CERTAINTY = 0.99;

/**
 * Result-count guards for `POST /junk-to-guarantee`. The results are sorted
 * fewest-to-farm first, and the long tail (junks needing tens of thousands) is
 * useless, so we page. `limit` is always enforced server-side:
 * `effective = min(limit ?? DEFAULT_GUARANTEE_LIMIT, MAX_GUARANTEE_LIMIT)` — an
 * omitted limit is defaulted and a client can never exceed the max.
 */
export const DEFAULT_GUARANTEE_LIMIT = 50;
export const MAX_GUARANTEE_LIMIT = 200;

/**
 * The accepted-outcome filters shared by both guarantee queries. Every array is
 * an **OR set**; an empty or omitted array is a wildcard ("accept any") on that
 * axis.
 */
export interface GuaranteeFilters {
  /**
   * Accepted equipment, by **name** (e.g. "Silver Two-Handed Axe"). Names are
   * the stable, human-readable, `@unique` public key — internal DB ids are
   * surrogate cuids that regenerate on a full reseed, so they never appear in
   * the API. The backend resolves names to ids. Omitted/empty = any equipment.
   */
  equipment?: string[],
  /** Accepted quality (★) levels, 1–5. Omitted/empty = any quality. */
  quality?: number[],
  /** Accepted grade levels, 1–5 (White…Red). Omitted/empty = any grade. */
  grade?: number[],
  /**
   * Required blessings, by **code** (e.g. "ATK", "ATK_PER", "SUR"), from the
   * shared `BLESSINGS` catalog. Unlike the other axes this is an **AND set** —
   * the item must carry *every* listed blessing at once. The codes are the
   * stable public key (like equipment/junk names); an unknown code is a 400.
   *
   * Because a piece's active blessing slots equal `grade − 1` and blessings
   * don't stack, this couples to `grade`: a combo needs a grade with enough
   * slots to hold it. The odds are a documented modelling estimate — responses
   * to blessing queries set {@link JunkToGuaranteeResult.estimated}. See
   * `docs/calculation.md`. Omitted/empty = no blessing requirement.
   */
  blessings?: string[],

  // Reserved — not yet implemented (no seed / deferred, see docs/calculation.md):
  //   tier?: GearTier[]        (OR)  — needs the tier seed
  //   category?: string[]      (OR)  — needs the category mapping
}

/** Body of `POST /junk-to-guarantee`. */
export interface JunkToGuaranteeQuery extends GuaranteeFilters {
  /**
   * Target confidence as a fraction in (0, 1) — e.g. 0.99 for "99% sure".
   * Defaults to {@link DEFAULT_CERTAINTY} when omitted. 1 (true 100%) is
   * unreachable and rejected.
   */
  certainty?: number,
  /**
   * Max results to return (the page size). Enforced: defaulted to
   * {@link DEFAULT_GUARANTEE_LIMIT} when omitted, clamped to
   * {@link MAX_GUARANTEE_LIMIT}. See the constants above.
   */
  limit?: number,
  /** Results to skip before the page (for "show more"). Defaults to 0. */
  offset?: number,
}

/** One junk's answer: how much of it to farm to reach the target confidence. */
export interface JunkGuaranteeEntry {
  /** The junk's `@unique` name — the public key (see {@link GuaranteeFilters.equipment}). */
  junkName: string,
  /**
   * Whether the source listed this junk's drop table more than once — a
   * frontend caveat flag (see `Junk.hasMultiplePools` in schema.prisma).
   */
  hasMultiplePools: boolean,
  /** P(match | one junk of this type), a fraction in (0, 1]. */
  probabilityPerJunk: number,
  /** Junk of this type needed to reach the query's certainty. */
  junkNeeded: number,
}

/**
 * Short human-readable caveat that accompanies {@link estimated} results. A
 * shared constant so the backend and any UI use identical wording.
 */
export const BLESSING_ESTIMATE_NOTE = TsUtilities.stringJoin([
  "Blessing odds are estimated from per-slot rates (the source gives no joint",
  "probabilities), so junk counts for blessing queries are approximate.",
]);

/** Response of `POST /junk-to-guarantee`. */
export interface JunkToGuaranteeResult {
  /** The effective certainty used. */
  certainty: number,
  /**
   * True when the query required blessings, so the numbers rely on the
   * documented blessing-joint estimate (see {@link GuaranteeFilters.blessings}).
   * Absent/false for pure equipment/quality/grade queries, which are exact.
   */
  estimated?: boolean,
  /** Present with {@link BLESSING_ESTIMATE_NOTE} whenever {@link estimated}. */
  estimatedNote?: string,
  /**
   * Matching junks, sorted ascending by {@link JunkGuaranteeEntry.junkNeeded}
   * (fewest to farm first). Junks that can never yield the target (P ≤ 0) are
   * omitted entirely. This is a page — see {@link total} / {@link hasMore}.
   */
  results: JunkGuaranteeEntry[],
  /** Total matching junks across all pages (before `limit`/`offset`). */
  total: number,
  /** Whether more matching junks exist beyond this page (for "show more"). */
  hasMore: boolean,
}

/**
 * Body of `POST /junk-to-guarantee/curve`: the same filters, but for a single
 * junk, reporting how much of it is needed across several confidence levels.
 */
export interface CertaintyCurveQuery extends GuaranteeFilters {
  /** The single junk to compute the curve for, by **name** (the public key). */
  junkName: string,
  /** Confidence levels (fractions in (0, 1)) to report `junkNeeded` for. */
  certainties: number[],
}

/** One point on the certainty curve. */
export interface CertaintyCurvePoint {
  certainty: number,
  /** Junk needed at this certainty; `null` if the target is impossible for this junk. */
  junkNeeded: number | null,
}

/** Response of `POST /junk-to-guarantee/curve`. */
export interface CertaintyCurveResult {
  junkName: string,
  /** P(match | one junk of this type); 0 if the target is impossible here. */
  probabilityPerJunk: number,
  /** True when the query required blessings — see {@link JunkToGuaranteeResult.estimated}. */
  estimated?: boolean,
  /** Present with {@link BLESSING_ESTIMATE_NOTE} whenever {@link estimated}. */
  estimatedNote?: string,
  /** One entry per requested certainty, in the requested order. */
  points: CertaintyCurvePoint[],
}
