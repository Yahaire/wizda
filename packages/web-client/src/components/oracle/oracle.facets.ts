/**
 * Which filter options still lead anywhere, and which picks have stopped fitting
 * together — the Oracle's faceting rules.
 *
 * The API ANDs the three *identity* axes (equipment name, category, rank) while
 * OR-ing within each, so a piece must satisfy every axis that's set. Left alone,
 * that lets a player ask for a Bronze sword at Silver rank and get a silent zero.
 * Everything here exists to make that unaskable: an option is offered only when
 * some piece would survive picking it, and the axes that *can't* be pre-empted
 * this way (quality, grade, blessings) are checked against what's left so the page
 * can raise its cleanup prompt instead.
 *
 * The `candidates` in play are always the equipment the identity axes admit; the
 * outcome axes then read off that set — see {@link candidateEquipment}.
 */

import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';
import { BLESSINGS } from '@shared/domain/stats';
import { TsUtilities } from '@shared/tsUtilities';

import {
    blessingFloorPhrase, blessingLabel, EMPTY_FILTERS, gradeFloorFor, gradeName, joinHuman,
    MAX_LEVEL, OracleFilters, qualityLabel
} from './oracle.logic';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

/** The identity axes: the three that decide *which pieces* are in play. */
type IdentityAxis = 'equipment' | 'category' | 'rank';

/**
 * The value an item carries on one identity axis, or null when it has none — a
 * handful of items were never matched by the taxonomy enrichment and so have no
 * rank or category. The API filters those out whenever the axis is set (a `null`
 * column can't be `IN` a list), and this mirrors that: an unclassified piece is
 * admitted only while the axis is a wildcard.
 */
function valueOn(item: EquipmentListItem, axis: IdentityAxis): string | null {
  switch (axis) {
    case 'equipment':
      return item.name;
    case 'category':
      return item.category?.code ?? null;
    case 'rank':
      return item.rank;
  }
}

/** Whether an item satisfies one axis. An empty axis is a wildcard, so it does. */
function satisfiesAxis(item: EquipmentListItem, axis: IdentityAxis, selected: string[]): boolean {
  if (selected.length === 0) {
    return true;
  }
  const value = valueOn(item, axis);
  return value !== null && selected.includes(value);
}

const IDENTITY_AXES: IdentityAxis[] = ['equipment', 'category', 'rank'];

/** Whether an item satisfies every identity axis except the ones named. */
function satisfiesIdentity(
  item: EquipmentListItem,
  filters: OracleFilters,
  except?: IdentityAxis,
): boolean {
  return IDENTITY_AXES.every(
    (axis) => axis === except || satisfiesAxis(item, axis, filters[axis]),
  );
}

/**
 * The equipment the identity axes admit — every piece matching the equipment,
 * category, *and* rank filters. With all three left blank that's the whole list,
 * which is what an unfiltered query means.
 */
export function candidateEquipment(
  all: readonly EquipmentListItem[],
  filters: OracleFilters,
): EquipmentListItem[] {
  return all.filter((item) => satisfiesIdentity(item, filters));
}

/**
 * The values of one identity axis that some candidate would still have, judging
 * the axis against the *other* two only.
 *
 * That "other two" is the whole trick. Within an axis the values OR together, so
 * adding a second category can only widen the result — the only pick that can
 * empty the set is the first one on a previously-blank axis. Judging each value
 * against the other axes covers exactly that case, and it does so symmetrically:
 * pick a Bronze sword and Silver leaves the rank list; pick Silver and the Bronze
 * sword leaves the equipment list. A selection reached by only ever taking offered
 * options therefore always has candidates, and dropping a pick only ever widens.
 */
export function availableOn(
  all: readonly EquipmentListItem[],
  filters: OracleFilters,
  axis: IdentityAxis,
): Set<string> {
  const available = new Set<string>();
  for (const item of all) {
    const value = valueOn(item, axis);
    if (value !== null && satisfiesIdentity(item, filters, axis)) {
      available.add(value);
    }
  }
  return available;
}

/**
 * Whether a piece can roll every one of the required blessings. Not every piece
 * can roll every blessing (a sword never rolls DEF), and the blessing axis is an
 * AND — one piece must carry them all — so a set is only satisfiable if a single
 * candidate covers it, never by two candidates between them.
 */
function carriesAll(item: EquipmentListItem, required: readonly string[]): boolean {
  const rollable = new Set(item.blessings);
  return required.every((code) => rollable.has(code));
}

/**
 * The candidates that could actually answer the query: those carrying every
 * required blessing. Empty means the blessing picks contradict the gear picks,
 * however many candidates there are.
 */
export function satisfyingEquipment(
  candidates: readonly EquipmentListItem[],
  blessings: readonly string[],
): EquipmentListItem[] {
  if (blessings.length === 0) {
    return [...candidates];
  }
  return candidates.filter((item) => carriesAll(item, blessings));
}

/**
 * The blessings still worth offering: those some candidate can roll *alongside*
 * the ones already required. Checked as a set rather than one code at a time —
 * a plate helm rolls DEF and a sword rolls ATK, but "DEF and ATK" is reachable
 * only if one piece rolls both.
 */
export function availableBlessings(
  candidates: readonly EquipmentListItem[],
  blessings: readonly string[],
): Set<string> {
  const available = new Set<string>();
  for (const item of candidates) {
    if (!carriesAll(item, blessings)) {
      continue;
    }
    for (const code of item.blessings) {
      available.add(code);
    }
  }
  return available;
}

/**
 * The longest run of the player's blessing picks, kept in the order they made
 * them, that some candidate can still carry. The cleanup for a blessing set the
 * gear can no longer answer: their earliest picks were the ones they made with
 * the fewest other constraints in play, so those are the ones to keep.
 */
export function longestSatisfiableBlessings(
  candidates: readonly EquipmentListItem[],
  blessings: readonly string[],
): string[] {
  const kept: string[] = [];
  for (const code of blessings) {
    const next = [...kept, code];
    if (candidates.some((item) => carriesAll(item, next))) {
      kept.push(code);
    }
  }
  return kept;
}

/**
 * Highest level (grade/quality) reachable across the given equipment. A level is
 * reachable if *any* piece can drop it (the guarantee is an OR across equipment),
 * and a piece with unknown max (null) is treated as {@link MAX_LEVEL} so we never
 * over-constrain on missing data. No equipment at all = no limit.
 */
function maxReachable(
  items: readonly EquipmentListItem[],
  key: 'maxDropGrade' | 'maxDropQuality',
): number {
  if (items.length === 0) {
    return MAX_LEVEL;
  }
  return items.reduce((max, item) => Math.max(max, item[key] ?? MAX_LEVEL), 1);
}

/** The ceiling on the grade axis: the best grade the equipment in play drops. */
export function maxReachableGrade(items: readonly EquipmentListItem[]): number {
  return maxReachable(items, 'maxDropGrade');
}

/** The ceiling on the quality axis: the best star count the equipment in play drops. */
export function maxReachableQuality(items: readonly EquipmentListItem[]): number {
  return maxReachable(items, 'maxDropQuality');
}

// ---------------------------------------------------------------------------
// Conflicts — a selection the offered options couldn't have prevented.
// ---------------------------------------------------------------------------

/** A selection that can't be satisfied, and the change that would rescue it. */
export interface OracleConflict {
  /** Wizda's explanation, shown in the blocking prompt. */
  message: string,
  /**
   * The filter change that resolves it, or null when nothing short of taking the
   * pick back will — asking for four blessings on gear that only drops Purple has
   * no in-range answer, so that prompt offers only the undo.
   */
  fix: Partial<OracleFilters> | null,
}

/**
 * Why no candidate carries all the required blessings. Two different failures wear
 * the same symptom: a blessing nothing in play rolls at all, and a *combination* no
 * single piece rolls even though each is fine alone (the axis is an AND). Say which,
 * since the fix a player would reach for differs.
 */
function blessingConflictMessage(
  candidates: readonly EquipmentListItem[],
  blessings: readonly string[],
): string {
  const rollableAtAll = availableBlessings(candidates, []);
  const unrollable = blessings.filter((code) => !rollableAtAll.has(code));
  const labels = joinHuman(unrollable.map(blessingLabel), 'or');

  if (unrollable.length === 1) {
    return `Nothing you've picked ever rolls ${labels}.`;
  }
  if (unrollable.length > 1) {
    return `Nothing you've picked rolls ${labels}.`;
  }
  return TsUtilities.stringJoin([
    `No single piece you've picked carries ${joinHuman(blessings.map(blessingLabel))} together,`,
    "and a blessing only counts if it's on the piece you're hunting.",
  ]);
}

/**
 * The contradiction in the current selection, if any. The identity axes can't
 * contradict each other through the UI — unavailable options aren't offered — so
 * the first case only fires on a selection restored from an older visit, or one
 * the data has moved out from under. The rest are the axes no amount of greying
 * out can pre-empt, since they're read off whatever gear survives.
 *
 * Both level axes are minimums, so only one sitting *above* what the gear drops
 * can contradict anything: a minimum under the blessing floor merely restates the
 * floor, which the grade slider shows rather than argues with.
 */
export function detectConflict(
  candidates: readonly EquipmentListItem[],
  satisfying: readonly EquipmentListItem[],
  filters: OracleFilters,
): OracleConflict | null {
  if (candidates.length === 0) {
    return {
      message: TsUtilities.stringJoin([
        "Your gear, category, and rank picks don't overlap — nothing is all three at once.",
        "I can drop the category and rank and keep the gear you named.",
      ]),
      fix: { category: [], rank: [] },
    };
  }

  if (satisfying.length === 0) {
    return {
      message: blessingConflictMessage(candidates, filters.blessings),
      fix: { blessings: longestSatisfiableBlessings(candidates, filters.blessings) },
    };
  }

  const maxGrade = maxReachableGrade(satisfying);
  const maxQuality = maxReachableQuality(satisfying);
  const gradeFloor = gradeFloorFor(filters.blessings.length);

  // Nothing to tidy: no grade both carries the blessings and drops from that
  // gear, whatever the grade filter says. Only taking a pick back can help.
  if (gradeFloor > maxGrade) {
    return {
      message: TsUtilities.stringJoin([
        `${blessingFloorPhrase(filters.blessings.length, gradeFloor)}, and that gear never drops that high.`,
        "Ask for fewer blessings, or grind something else.",
      ]),
      fix: null,
    };
  }

  const gradeTooHigh = filters.minGrade > maxGrade;
  const qualityTooHigh = filters.minQuality > maxQuality;
  if (!gradeTooHigh && !qualityTooHigh) {
    return null;
  }

  let message: string;
  if (gradeTooHigh && !qualityTooHigh) {
    message = `I don't think that gear ever drops as high as ${gradeName(filters.minGrade).toLowerCase()}.`;
  } else if (qualityTooHigh && !gradeTooHigh) {
    message = `Selected gear doesn't seem to reach ${qualityLabel(filters.minQuality)}.`;
  } else {
    message = "Some of your picks don't fit together anymore.";
  }

  // Lower each minimum to what the gear actually drops, which keeps the intent
  // ("the best I can get") where dropping the axis entirely would lose it.
  return {
    message,
    fix: {
      minGrade: Math.min(filters.minGrade, maxGrade),
      minQuality: Math.min(filters.minQuality, maxQuality),
    },
  };
}

// ---------------------------------------------------------------------------
// The whole derived view, in one pass.
// ---------------------------------------------------------------------------

/** Everything the filter panel needs to know about the current selection. */
export interface OracleFacets {
  /** Equipment names that still fit the category/rank picks. */
  equipment: Set<string>,
  /**
   * Every category some catalogued piece belongs to, whatever the current picks —
   * the categories worth putting on the menu at all. The Oracle works off only
   * junk-droppable gear (its input is pre-filtered to pieces with junk sources),
   * so a category missing here is one no junk yields: Tools, today. Offering it
   * greyed-out would be a riddle ("why?"); leaving it off says the same thing and
   * asks nothing. Derived, not hardcoded, so the day a junk starts dropping Tools
   * they appear on their own.
   */
  catalogCategory: Set<string>,
  /** Category codes some candidate still has, given the equipment/rank picks. */
  category: Set<string>,
  /** Rank kinds some candidate still has, given the equipment/category picks. */
  rank: Set<string>,
  /** Blessings some candidate could roll alongside the ones already required. */
  blessings: Set<string>,
  /** Ceiling on the grade slider. */
  maxGrade: number,
  /** Ceiling on the quality slider. */
  maxQuality: number,
  /** The contradiction to prompt about, if any. */
  conflict: OracleConflict | null,
}

/**
 * The facets for a selection made against the whole equipment catalog.
 *
 * Before the catalog lands (`all` empty or null) nothing is known, so nothing is
 * withheld: every option is offered and no conflict is claimed. Getting that
 * backwards would grey out the entire panel for the length of one fetch, and —
 * worse — flash a cleanup prompt at a player who has picked nothing at all.
 *
 * Equipment names the catalog doesn't have are ignored rather than treated as
 * unsatisfiable. A remembered selection can name gear a later scrape dropped, and
 * the page prunes those on the render after the catalog arrives; reading them as a
 * contradiction in between would raise a prompt about gear that no longer exists.
 */
export function computeFacets(
  all: readonly EquipmentListItem[] | null,
  filters: OracleFilters,
): OracleFacets {
  if (!all?.length) {
    const everyCategory = new Set(EQUIPMENT_CATEGORIES.map((category) => category.code));
    return {
      equipment: new Set(filters.equipment),
      catalogCategory: everyCategory,
      category: everyCategory,
      rank: new Set(EQUIPMENT_RANKS.map((entry) => entry.kind as string)),
      blessings: new Set(BLESSINGS.map((blessing) => blessing.code)),
      maxGrade: MAX_LEVEL,
      maxQuality: MAX_LEVEL,
      conflict: null,
    };
  }

  const known = new Set(all.map((item) => item.name));
  const selection: OracleFilters = {
    ...filters,
    equipment: filters.equipment.filter((name) => known.has(name)),
  };

  const candidates = candidateEquipment(all, selection);
  const satisfying = satisfyingEquipment(candidates, selection.blessings);

  return {
    equipment: availableOn(all, selection, 'equipment'),
    // Judged against nothing at all: what the catalog *has*, not what the picks leave.
    catalogCategory: availableOn(all, EMPTY_FILTERS, 'category'),
    category: availableOn(all, selection, 'category'),
    rank: availableOn(all, selection, 'rank'),
    blessings: availableBlessings(candidates, selection.blessings),
    // Read off the gear that could actually answer the query: a piece that reaches
    // Red is no help if it can't roll the blessings the player asked for.
    maxGrade: maxReachableGrade(satisfying),
    maxQuality: maxReachableQuality(satisfying),
    conflict: detectConflict(candidates, satisfying, selection),
  };
}
