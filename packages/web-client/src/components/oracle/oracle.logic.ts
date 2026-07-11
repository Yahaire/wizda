import type {
  GuaranteeFilters,
  MatchedOutcome,
} from '@shared/api/endpoints/junkToGuarantee.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
import type { EquipmentRankKind } from '@shared/domain/rank';
import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';
import { GRADES } from '@shared/domain/grade';
import { QUALITIES } from '@shared/domain/quality';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';
import { BLESSINGS } from '@shared/domain/stats';
import { TsUtilities } from '@shared/tsUtilities';

/** Grade 5 (Red) unlocks 4 active blessing slots — no piece can hold more. */
export const MAX_BLESSINGS = 4;

/**
 * The two ordered axes (quality ★1–5, grade White…Red) share a scale. Both are
 * filtered as a *minimum* — "this and everything above it" — so {@link MIN_LEVEL}
 * accepts every level there is, i.e. it means "any".
 */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

/** localStorage key for the remembered filter selection (bump on shape change). */
export const FILTERS_STORAGE_KEY = 'wizda.oracle.filters.v3';

/**
 * Plain-language explanations shown in each filter's info modal (the ⓘ next to
 * the label). Written in Wizda's warm, casual voice.
 */
export const FILTER_DESCRIPTIONS = {
  equipment: TsUtilities.stringJoin([
    "Pick the gear you're hunting.",
    "I'll rank every junk that can drop any piece you choose — so you can chase a few at once.",
  ]),
  quality: TsUtilities.stringJoin([
    "Quality is the star count, 1★ up to 5★.",
    "Higher quality means bigger blessing values on the piece.",
    "Set the lowest you'd be happy to walk away with — I'll count everything from there up.",
  ]),
  grade: TsUtilities.stringJoin([
    "Grade shows in-game as a colour: White, Green, Blue, Purple, then Red.",
    "It sets how many blessing slots are active — White has none, and each colour up adds one, so Red holds four.",
    "Set the lowest grade you'd be happy to walk away with — I'll count everything from there up.",
  ]),
  blessings: TsUtilities.stringJoin([
    "Blessings are the bonus stats a piece can roll.",
    "I only count gear that carries ALL the blessings you pick.",
    "A single piece holds at most four, so that's the cap.",
    "Not every piece rolls every blessing — a sword will never carry DEF —",
    "so I grey out the ones your gear can't reach.",
  ]),
  category: TsUtilities.stringJoin([
    "The kind of gear — daggers, heavy armor, shoes, that sort of thing.",
    "Pick any categories you'd take, and I'll only count junk that drops them.",
    "I only list the kinds junk hands out at all, so you won't find Tools here.",
  ]),
  rank: TsUtilities.stringJoin([
    "A gear's rank — its material, from Bronze up to Silver.",
    "Some folks call it \"tier\" — just don't mix it up with your adventurer rank!",
    "Pick every rank you'd be happy with.",
    "I leave out Worn, since no amount of junk will ever hand you one.",
  ]),
  certainty: TsUtilities.stringJoin([
    "How sure you want to be before you stop grinding.",
    "90% means that, nine times out of ten, you'd have the item by the number I show.",
    "Just know, not even GREAT Agora can promise you 100%!",
  ]),
} as const;

export interface OracleFilters {
  /** Equipment names (public key). */
  equipment: string[],
  /** Equipment category codes (OR set). */
  category: string[],
  /** Equipment rank kinds (OR set). */
  rank: string[],
  /** Lowest acceptable quality star level, 1–5. {@link MIN_LEVEL} accepts any. */
  minQuality: number,
  /** Lowest acceptable grade, 1–5. {@link MIN_LEVEL} accepts any. */
  minGrade: number,
  /** Blessing codes (AND set). */
  blessings: string[],
  /** Target confidence as a whole percent, 1–99.99. */
  certaintyPct: number,
}

export const DEFAULT_CERTAINTY_PCT = 90;
export const MAX_CERTAINTY_PCT = 99.99;
export const MIN_CERTAINTY_PCT = 1;

/** How far above/below the selected certainty the detail curve reaches (points). */
export const CERTAINTY_STEP = 5;

/**
 * Three certainty levels to chart around the selected one: a step below, the
 * selection, and a step above. When a neighbour would fall outside
 * [{@link MIN_CERTAINTY_PCT}, {@link MAX_CERTAINTY_PCT}], the whole window slides
 * inward so we still show three distinct, in-range levels with the selection at
 * the edge — e.g. at the 1% floor we show 1 / 6 / 11, and at the 99.99% cap we
 * show 89.99 / 94.99 / 99.99. Returned ascending.
 */
export function certaintyWindow(selectedPct: number): number[] {
  const step = CERTAINTY_STEP;
  if (selectedPct - step < MIN_CERTAINTY_PCT) {
    // No room below — slide the window up so the selection is the floor.
    return [selectedPct, selectedPct + step, selectedPct + step * 2];
  }
  if (selectedPct + step > MAX_CERTAINTY_PCT) {
    // No room above — slide the window down so the selection is the ceiling.
    return [selectedPct - step * 2, selectedPct - step, selectedPct];
  }
  return [selectedPct - step, selectedPct, selectedPct + step];
}

/** A certainty percent as a compact label: "85%", "94.99%" (no trailing zeros). */
export function formatCertaintyPct(pct: number): string {
  return `${Number(pct.toFixed(2))}%`;
}

/**
 * A probability as a percent label. Drop rates run tiny, so below 1% we keep two
 * significant figures ("0.042%") rather than rounding them all to "0.0%".
 */
export function formatPercent(probability: number): string {
  const percent = probability * 100;
  if (percent >= 1) {
    return `${percent.toFixed(1)}%`;
  }
  if (percent <= 0) {
    return "0%";
  }
  return `${percent.toPrecision(2)}%`;
}

/**
 * The levels a minimum accepts: `min` and everything above it. A minimum of
 * {@link MIN_LEVEL} accepts every level there is, which is what the API already
 * means by an absent axis — so it yields the empty (wildcard) set rather than a
 * pointless five-element one.
 */
export function levelsFrom(min: number): number[] {
  if (min <= MIN_LEVEL) {
    return [];
  }
  return Array.from({ length: MAX_LEVEL - min + 1 }, (_unused, index) => min + index);
}

/** A stored minimum as the slider shows it: inside the bounds the rest of the query allows. */
export function clampLevel(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * The active accepted-outcome filters as an API {@link GuaranteeFilters} object,
 * omitting every empty axis (a wildcard). Shared by the guarantee query and the
 * certainty-curve query so they always constrain the junk pool identically.
 */
export function activeFilters(filters: OracleFilters): GuaranteeFilters {
  const quality = levelsFrom(filters.minQuality);
  const grade = levelsFrom(filters.minGrade);
  return {
    ...(filters.equipment.length ? { equipment: filters.equipment } : {}),
    ...(filters.category.length ? { category: filters.category } : {}),
    ...(filters.rank.length ? { rank: filters.rank as EquipmentRankKind[] } : {}),
    ...(quality.length ? { quality } : {}),
    ...(grade.length ? { grade } : {}),
    ...(filters.blessings.length ? { blessings: filters.blessings } : {}),
  };
}

/** Nothing asked for on any axis — the baseline the filters are built up from. */
export const EMPTY_FILTERS: OracleFilters = {
  equipment: [],
  category: [],
  rank: [],
  minQuality: MIN_LEVEL,
  minGrade: MIN_LEVEL,
  blessings: [],
  certaintyPct: DEFAULT_CERTAINTY_PCT,
};

/**
 * Where a player who has told us nothing yet starts: 3★ Blue and up.
 *
 * A blank slate would be a wasted first move — the tool would refuse to run until
 * they picked something (see the `NO_QUERY` guard). This is the middle of both
 * scales, which is a plausible thing to want and, more usefully, *demonstrates*
 * that the axes are minimums the moment they land on the page.
 */
export const DEFAULT_FILTERS: OracleFilters = {
  ...EMPTY_FILTERS,
  minQuality: 3,
  minGrade: 3,
};

/** Whether any accepted-outcome filter is set (certainty alone doesn't count). */
export function hasAnyFilter(filters: OracleFilters): boolean {
  return Boolean(
    filters.equipment.length
    || filters.category.length
    || filters.rank.length
    || filters.minQuality > MIN_LEVEL
    || filters.minGrade > MIN_LEVEL
    || filters.blessings.length,
  );
}

/**
 * The floor the blessing count puts under the grade axis: carrying K blessings
 * needs a grade with ≥ K active slots (slots = value − 1), i.e. value ≥ K + 1.
 *
 * Asking for *less* than the floor isn't a contradiction — a minimum of White
 * with four blessings still only ever lands Red — so this narrows the axis
 * rather than invalidating a pick. It only bites when it climbs past
 * {@link maxReachableGrade}, where nothing can satisfy the query at all.
 */
export function gradeFloorFor(blessingCount: number): number {
  return Math.min(blessingCount + 1, MAX_LEVEL);
}

/** "3 blessings need Purple or better" — the grade floor, said out loud. */
export function blessingFloorPhrase(blessingCount: number, floor: number): string {
  const subject = blessingCount === 1 ? "1 blessing needs" : `${blessingCount} blessings need`;
  const target = floor >= MAX_LEVEL ? gradeName(floor) : `${gradeName(floor)} or better`;
  return `${subject} ${target}`;
}

export function gradeName(value: number): string {
  return GRADES.find((grade) => grade.value === value)?.name ?? `grade ${value}`;
}

export function qualityLabel(value: number): string {
  return QUALITIES.find((quality) => quality.value === value)?.label ?? `★${value}`;
}

/** Short player-friendly blessing label: "ATK", "ATK%", "SUR". */
export function blessingLabel(code: string): string {
  const blessing = BLESSINGS.find((entry) => entry.code === code);
  if (!blessing) {
    return code;
  }
  return blessing.isPercent ? `${blessing.statKind}%` : blessing.statKind;
}

/**
 * Join a list the way a person would speak it: "a", "a and b", "a, b, and c".
 * Pass `"or"` for the accepted-outcome (OR set) axes, where "and" would misread.
 */
export function joinHuman(items: string[], conjunction: 'and' | 'or' = 'and'): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  if (items.length === 2) {
    return `${items[0]} ${conjunction} ${items[1]}`;
  }
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Describing a query back to the player — see `QuerySummary.tsx`. Everything here
// reads a `MatchedOutcome` (the query resolved against one junk) where available,
// falling back to the raw filters when the curve request hasn't landed or failed.
// ---------------------------------------------------------------------------

const RANK_NAME_BY_KIND = new Map(EQUIPMENT_RANKS.map((rank) => [rank.kind as string, rank.name]));
const CATEGORY_NAME_BY_CODE = new Map(
  EQUIPMENT_CATEGORIES.map((category) => [category.code, category.name]),
);

/** How many equipment names the subject line shows before collapsing to "+N more". */
export const SUBJECT_EQUIPMENT_CAP = 3;

/** The axes of a query, after narrowing to a junk where that's known. */
export interface ResolvedQuery {
  equipment: string[],
  rank: string[],
  category: string[],
  quality: number[],
  grade: number[],
  blessings: string[],
}

/**
 * The query as it applies to one junk. `matched` omits an axis the query left as a
 * wildcard, so an absent axis falls back to the (empty) filter — and when `matched`
 * is null altogether (request pending or failed) the raw query stands in. The two
 * minimum axes are spelled back out as the level sets they stand for, which is what
 * the junk narrowed and what the summary draws.
 */
export function resolveQuery(
  matched: MatchedOutcome | null,
  filters: OracleFilters,
): ResolvedQuery {
  return {
    equipment: matched?.equipment ?? filters.equipment,
    rank: matched?.rank ?? filters.rank,
    category: matched?.category ?? filters.category,
    quality: matched?.quality ?? levelsFrom(filters.minQuality),
    grade: matched?.grade ?? levelsFrom(filters.minGrade),
    // The AND set is required in full, so it never narrows.
    blessings: filters.blessings,
  };
}

/**
 * The best level each minimum axis can reach across the whole selection — the
 * ceiling the quality/grade sliders' upper bound showed the player. Computed from
 * the gear the query admits; see `maxReachableQuality`/`maxReachableGrade` in
 * `oracle.facets.ts`.
 */
export interface OutcomeCeilings {
  quality: number,
  grade: number,
}

/**
 * The top level in a set, or {@link MAX_LEVEL} for an empty (wildcard) axis. A
 * wildcard reaches everything, so it never reads as having been capped.
 */
function levelCeiling(levels: number[]): number {
  return levels.length === 0 ? MAX_LEVEL : Math.max(...levels);
}

/**
 * Returns true when this junk drops less than the query asked for in a way the
 * on-screen filters didn't already make plain — the test for whether to show the
 * "narrowed" note under the summary. (When the shortfall was already visible from
 * the filters, returns false: the note would only repeat them.)
 *
 * Two kinds of narrowing, judged differently:
 *
 * - Identity (a named equipment / category / rank this junk doesn't drop) is always
 *   worth flagging: the subject line quietly shows only the survivors, so nothing
 *   else on the card reveals it.
 *
 * - Quality/grade are minimums ("3★ and up"), so the junk caps them almost every
 *   time — next to nothing rolls 5★ Red. Capping to the *selection's* ceiling isn't
 *   news: the slider's upper bound already showed that ceiling ({@link OutcomeCeilings}),
 *   and the summary chips show where this junk lands. It's only worth a note when this
 *   junk falls *below* that ceiling — a Bronze dagger some junks drop at 5★ Red but
 *   this one caps at 4★ Purple is a real loss the slider implied was on the table.
 */
export function wasNarrowed(
  matched: MatchedOutcome | null,
  filters: OracleFilters,
  ceilings: OutcomeCeilings,
): boolean {
  if (!matched) {
    return false;
  }
  const resolved = resolveQuery(matched, filters);
  return (
    resolved.equipment.length < filters.equipment.length
    || resolved.rank.length < filters.rank.length
    || resolved.category.length < filters.category.length
    || levelCeiling(resolved.quality) < ceilings.quality
    || levelCeiling(resolved.grade) < ceilings.grade
  );
}

export interface QuerySubject {
  /** The subject text, e.g. `"Any Silver Two-Handed Axe"`. */
  text: string,
  /** Equipment names past {@link SUBJECT_EQUIPMENT_CAP}, revealed by "+N more". */
  hidden: string[],
}

/**
 * The player's query as a noun phrase — the thing they're hunting.
 *
 * Named equipment speaks for itself, and rank/category are dropped there: they can
 * only have narrowed *which* names survive, which the list already shows. With
 * nothing named, rank becomes an adjective on the category ("Any Silver Odachi").
 * That reads badly once both axes are plural — "Any Silver or Ebonsteel Odachi or
 * Katana" parses several ways — so the ranks move into a trailing parenthetical.
 */
export function subjectOf(query: ResolvedQuery): QuerySubject {
  if (query.equipment.length > 0) {
    const shown = query.equipment.slice(0, SUBJECT_EQUIPMENT_CAP);
    const hidden = query.equipment.slice(SUBJECT_EQUIPMENT_CAP);
    return {
      // A dangling "or" before "+N more" would lie about the list being complete.
      text: hidden.length > 0 ? shown.join(', ') : joinHuman(shown, 'or'),
      hidden,
    };
  }

  const ranks = query.rank.map((kind) => RANK_NAME_BY_KIND.get(kind) ?? kind);
  const categories = query.category.map((code) => CATEGORY_NAME_BY_CODE.get(code) ?? code);
  const noun = categories.length > 0 ? joinHuman(categories, 'or') : 'equipment';

  if (ranks.length === 0) {
    return { text: `Any ${noun}`, hidden: [] };
  }
  if (ranks.length === 1 || categories.length <= 1) {
    return { text: `Any ${joinHuman(ranks, 'or')} ${noun}`, hidden: [] };
  }
  return { text: `Any ${noun} (${joinHuman(ranks, 'or')})`, hidden: [] };
}

/** What the subject line's icon should depict, and what colour(s) to tint it. */
export interface SubjectIdentity {
  /**
   * The single category every candidate shares, or null when they differ or aren't
   * known — an icon can only stand for the subject if the subject has one shape.
   */
  categoryCode: string | null,
  /** Distinct ranks across the candidates, ascending. Empty when unconstrained. */
  rankKinds: string[],
}

const RANK_ORDER = new Map(EQUIPMENT_RANKS.map((rank) => [rank.kind as string, rank.orderIndex]));

/**
 * The shape and colour the query's subject has, if it has just one of each.
 *
 * Named equipment is authoritative: a piece knows its own category and rank, so the
 * rank filter (which can only have narrowed *which* pieces survive) is ignored. With
 * nothing named we fall back to the queried category/rank axes. A piece missing its
 * taxonomy (a handful aren't enriched) forfeits the category — we can't claim the
 * candidates share one shape when we don't know one of their shapes.
 */
export function subjectIdentity(
  query: ResolvedQuery,
  equipmentByName: Map<string, EquipmentListItem>,
): SubjectIdentity {
  const ascendingRanks = (kinds: string[]): string[] => (
    [...new Set(kinds)].sort((left, right) => (RANK_ORDER.get(left) ?? 0) - (RANK_ORDER.get(right) ?? 0))
  );

  const named = query.equipment
    .map((name) => equipmentByName.get(name))
    .filter((item): item is EquipmentListItem => Boolean(item));

  if (named.length === 0) {
    return {
      categoryCode: query.category.length === 1 ? query.category[0]! : null,
      rankKinds: ascendingRanks(query.rank),
    };
  }

  const categories = new Set(named.map((item) => item.category?.code ?? null));
  const shared = categories.size === 1 ? [...categories][0]! : null;
  return {
    categoryCode: shared,
    rankKinds: ascendingRanks(named.flatMap((item) => (item.rank ? [item.rank] : []))),
  };
}

/** Below this, a contiguous run is clearer listed out ("3★/4★") than ranged. */
const QUALITY_RANGE_MIN_RUN = 3;

/**
 * How to draw an accepted-quality set. One level gets written stars, matching the
 * game's own display; several would turn into a glyph-counting exercise, so they
 * fall back to the compact "3★" notation, slash-joined. A contiguous run only
 * collapses to a range once it's long enough to be worth compressing — "3★/4★"
 * says the same as "3★–4★" and reads more plainly.
 */
export type QualityDisplay =
  | { kind: 'stars', value: number }
  | { kind: 'range', from: number, to: number }
  | { kind: 'levels', values: number[] };

export function qualityDisplay(values: number[]): QualityDisplay | null {
  const levels = [...new Set(values)].sort((left, right) => left - right);
  if (levels.length === 0) {
    return null;
  }
  if (levels.length === 1) {
    return { kind: 'stars', value: levels[0]! };
  }
  const contiguous = levels.every((level, index) => index === 0 || level === levels[index - 1]! + 1);
  if (contiguous && levels.length >= QUALITY_RANGE_MIN_RUN) {
    return { kind: 'range', from: levels[0]!, to: levels[levels.length - 1]! };
  }
  return { kind: 'levels', values: levels };
}
