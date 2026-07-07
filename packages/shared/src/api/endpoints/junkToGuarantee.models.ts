/**
 * Request/response contract for the "how much junk to guarantee item X?"
 * endpoints. Pure types shared by the backend (which produces them) and the
 * web-client (which consumes them). The math behind the numbers is in
 * `packages/shared/src/domain/dropRateMath.ts`; see `docs/calculation.md`.
 */

/** Default target confidence when a query omits `certainty` (99%). */
export const DEFAULT_CERTAINTY = 0.99;

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

  // Reserved — not yet implemented (no seed / deferred, see docs/calculation.md):
  //   tier?: GearTier[]        (OR)  — needs the tier seed
  //   category?: string[]      (OR)  — needs the category mapping
  //   blessings?: string[]     (AND) — needs the without-replacement joint
}

/** Body of `POST /junk-to-guarantee`. */
export interface JunkToGuaranteeQuery extends GuaranteeFilters {
  /**
   * Target confidence as a fraction in (0, 1) — e.g. 0.99 for "99% sure".
   * Defaults to {@link DEFAULT_CERTAINTY} when omitted. 1 (true 100%) is
   * unreachable and rejected.
   */
  certainty?: number,
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

/** Response of `POST /junk-to-guarantee`. */
export interface JunkToGuaranteeResult {
  /** The effective certainty used. */
  certainty: number,
  /**
   * Matching junks, sorted ascending by {@link JunkGuaranteeEntry.junkNeeded}
   * (fewest to farm first). Junks that can never yield the target (P ≤ 0) are
   * omitted entirely.
   */
  results: JunkGuaranteeEntry[],
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
  /** One entry per requested certainty, in the requested order. */
  points: CertaintyCurvePoint[],
}
