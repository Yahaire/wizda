import type {
  GuaranteeFilters,
  MatchedOutcome,
} from '@shared/api/endpoints/junkToGuarantee.models';
import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
import type { EquipmentTierKind } from '@shared/domain/tier';
import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';
import { GRADES } from '@shared/domain/grade';
import { QUALITIES } from '@shared/domain/quality';
import { BLESSINGS } from '@shared/domain/stats';
import { EQUIPMENT_TIERS } from '@shared/domain/tier';
import { TsUtilities } from '@shared/tsUtilities';

/** Grade 5 (Red) unlocks 4 active blessing slots — no piece can hold more. */
export const MAX_BLESSINGS = 4;

/** localStorage key for the remembered filter selection (bump on shape change). */
export const FILTERS_STORAGE_KEY = 'wizda.oracle.filters.v2';

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
    "Quality is the star rank, 1★ up to 5★.",
    "Higher quality means bigger blessing values on the piece.",
    "Pick every star level you'd be happy to walk away with.",
  ]),
  grade: TsUtilities.stringJoin([
    "Grade shows in-game as a colour: White, Green, Blue, Purple, then Red.",
    "It sets how many blessing slots are active — White has none, and each colour up adds one, so Red holds four.",
    "Pick every grade you'd be happy to walk away with.",
  ]),
  blessings: TsUtilities.stringJoin([
    "Blessings are the bonus stats a piece can roll.",
    "I only count gear that carries ALL the blessings you pick.",
    "A single piece holds at most four, so that's the cap.",
  ]),
  category: TsUtilities.stringJoin([
    "The kind of gear — daggers, heavy armor, shoes, that sort of thing.",
    "Pick any categories you'd take, and I'll only count junk that drops them.",
  ]),
  tier: TsUtilities.stringJoin([
    "A gear's tier — from Worn up to Silver.",
    "I'll only show you the tiers that",
    "Pick every tier you'd be happy with.",
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
  /** Equipment tier kinds (OR set). */
  tier: string[],
  /** Quality star levels, 1–5. */
  quality: number[],
  /** Grade levels, 1–5. */
  grade: number[],
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
 * The active accepted-outcome filters as an API {@link GuaranteeFilters} object,
 * omitting every empty axis (a wildcard). Shared by the guarantee query and the
 * certainty-curve query so they always constrain the junk pool identically.
 */
export function activeFilters(filters: OracleFilters): GuaranteeFilters {
  return {
    ...(filters.equipment.length ? { equipment: filters.equipment } : {}),
    ...(filters.category.length ? { category: filters.category } : {}),
    ...(filters.tier.length ? { tier: filters.tier as EquipmentTierKind[] } : {}),
    ...(filters.quality.length ? { quality: filters.quality } : {}),
    ...(filters.grade.length ? { grade: filters.grade } : {}),
    ...(filters.blessings.length ? { blessings: filters.blessings } : {}),
  };
}

export const EMPTY_FILTERS: OracleFilters = {
  equipment: [],
  category: [],
  tier: [],
  quality: [],
  grade: [],
  blessings: [],
  certaintyPct: DEFAULT_CERTAINTY_PCT,
};

/** Whether any accepted-outcome filter is set (certainty alone doesn't count). */
export function hasAnyFilter(filters: OracleFilters): boolean {
  return Boolean(
    filters.equipment.length
    || filters.category.length
    || filters.tier.length
    || filters.quality.length
    || filters.grade.length
    || filters.blessings.length,
  );
}

/**
 * Highest level (grade/quality) reachable across the selected equipment. A
 * level is reachable if *any* selected piece can drop it (the guarantee is an
 * OR across equipment), and an item with unknown max (null) is treated as 5 so
 * we never over-constrain on missing data. No equipment selected = no limit (5).
 */
function maxReachable(
  selected: EquipmentListItem[],
  key: 'maxDropGrade' | 'maxDropQuality',
): number {
  if (selected.length === 0) {
    return 5;
  }
  return selected.reduce((max, item) => Math.max(max, item[key] ?? 5), 1);
}

/**
 * The grade levels the current selection allows. Capped above by the selected
 * equipment's reachable grade, and floored by the blessing count: carrying K
 * blessings needs a grade with ≥ K active slots (slots = value − 1), i.e.
 * value ≥ K + 1.
 */
export function allowedGrades(
  selectedEquipment: EquipmentListItem[],
  blessingCount: number,
): Set<number> {
  const max = maxReachable(selectedEquipment, 'maxDropGrade');
  const min = Math.min(blessingCount + 1, 5);
  const set = new Set<number>();
  for (let grade = 1; grade <= 5; grade += 1) {
    if (grade >= min && grade <= max) {
      set.add(grade);
    }
  }
  return set;
}

/** The quality levels the current selection allows (capped by equipment). */
export function allowedQualities(selectedEquipment: EquipmentListItem[]): Set<number> {
  const max = maxReachable(selectedEquipment, 'maxDropQuality');
  const set = new Set<number>();
  for (let quality = 1; quality <= 5; quality += 1) {
    if (quality <= max) {
      set.add(quality);
    }
  }
  return set;
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

const TIER_NAME_BY_KIND = new Map(EQUIPMENT_TIERS.map((tier) => [tier.kind as string, tier.name]));
const CATEGORY_NAME_BY_CODE = new Map(
  EQUIPMENT_CATEGORIES.map((category) => [category.code, category.name]),
);

/** How many equipment names the subject line shows before collapsing to "+N more". */
export const SUBJECT_EQUIPMENT_CAP = 3;

/** The axes of a query, after narrowing to a junk where that's known. */
export interface ResolvedQuery {
  equipment: string[],
  tier: string[],
  category: string[],
  quality: number[],
  grade: number[],
  blessings: string[],
}

/**
 * The query as it applies to one junk. `matched` omits an axis the query left as a
 * wildcard, so an absent axis falls back to the (empty) filter — and when `matched`
 * is null altogether (request pending or failed) the raw query stands in.
 */
export function resolveQuery(
  matched: MatchedOutcome | null,
  filters: OracleFilters,
): ResolvedQuery {
  return {
    equipment: matched?.equipment ?? filters.equipment,
    tier: matched?.tier ?? filters.tier,
    category: matched?.category ?? filters.category,
    quality: matched?.quality ?? filters.quality,
    grade: matched?.grade ?? filters.grade,
    // The AND set is required in full, so it never narrows.
    blessings: filters.blessings,
  };
}

/** Whether narrowing to the junk dropped anything the player asked for. */
export function wasNarrowed(matched: MatchedOutcome | null, filters: OracleFilters): boolean {
  if (!matched) {
    return false;
  }
  const resolved = resolveQuery(matched, filters);
  return (
    resolved.equipment.length < filters.equipment.length
    || resolved.tier.length < filters.tier.length
    || resolved.category.length < filters.category.length
    || resolved.quality.length < filters.quality.length
    || resolved.grade.length < filters.grade.length
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
 * Named equipment speaks for itself, and tier/category are dropped there: they can
 * only have narrowed *which* names survive, which the list already shows. With
 * nothing named, tier becomes an adjective on the category ("Any Silver Odachi").
 * That reads badly once both axes are plural — "Any Silver or Ebonsteel Odachi or
 * Katana" parses several ways — so the tiers move into a trailing parenthetical.
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

  const tiers = query.tier.map((kind) => TIER_NAME_BY_KIND.get(kind) ?? kind);
  const categories = query.category.map((code) => CATEGORY_NAME_BY_CODE.get(code) ?? code);
  const noun = categories.length > 0 ? joinHuman(categories, 'or') : 'equipment';

  if (tiers.length === 0) {
    return { text: `Any ${noun}`, hidden: [] };
  }
  if (tiers.length === 1 || categories.length <= 1) {
    return { text: `Any ${joinHuman(tiers, 'or')} ${noun}`, hidden: [] };
  }
  return { text: `Any ${noun} (${joinHuman(tiers, 'or')})`, hidden: [] };
}

/** What the subject line's icon should depict, and what colour(s) to tint it. */
export interface SubjectIdentity {
  /**
   * The single category every candidate shares, or null when they differ or aren't
   * known — an icon can only stand for the subject if the subject has one shape.
   */
  categoryCode: string | null,
  /** Distinct tiers across the candidates, ascending. Empty when unconstrained. */
  tierKinds: string[],
}

const TIER_ORDER = new Map(EQUIPMENT_TIERS.map((tier) => [tier.kind as string, tier.orderIndex]));

/**
 * The shape and colour the query's subject has, if it has just one of each.
 *
 * Named equipment is authoritative: a piece knows its own category and tier, so the
 * tier filter (which can only have narrowed *which* pieces survive) is ignored. With
 * nothing named we fall back to the queried category/tier axes. A piece missing its
 * taxonomy (a handful aren't enriched) forfeits the category — we can't claim the
 * candidates share one shape when we don't know one of their shapes.
 */
export function subjectIdentity(
  query: ResolvedQuery,
  equipmentByName: Map<string, EquipmentListItem>,
): SubjectIdentity {
  const ascendingTiers = (kinds: string[]): string[] => (
    [...new Set(kinds)].sort((left, right) => (TIER_ORDER.get(left) ?? 0) - (TIER_ORDER.get(right) ?? 0))
  );

  const named = query.equipment
    .map((name) => equipmentByName.get(name))
    .filter((item): item is EquipmentListItem => Boolean(item));

  if (named.length === 0) {
    return {
      categoryCode: query.category.length === 1 ? query.category[0]! : null,
      tierKinds: ascendingTiers(query.tier),
    };
  }

  const categories = new Set(named.map((item) => item.category?.code ?? null));
  const shared = categories.size === 1 ? [...categories][0]! : null;
  return {
    categoryCode: shared,
    tierKinds: ascendingTiers(named.flatMap((item) => (item.tier ? [item.tier] : []))),
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
