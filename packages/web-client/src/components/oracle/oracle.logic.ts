import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';
import { GRADES } from '@shared/domain/grade';
import { QUALITIES } from '@shared/domain/quality';
import { BLESSINGS } from '@shared/domain/stats';
import { TsUtilities } from '@shared/tsUtilities';

/** Grade 5 (Red) unlocks 4 active blessing slots — no piece can hold more. */
export const MAX_BLESSINGS = 4;

/** localStorage key for the remembered filter selection (bump on shape change). */
export const FILTERS_STORAGE_KEY = 'wizda.oracle.filters.v1';

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
  certainty: TsUtilities.stringJoin([
    "How sure you want to be before you stop grinding.",
    "90% means that, nine times out of ten, you'd have the item by the number I show.",
    "Not even GREAT Agora can promise you 100%!",
  ]),
} as const;

export interface OracleFilters {
  /** Equipment names (public key). */
  equipment: string[],
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

export const EMPTY_FILTERS: OracleFilters = {
  equipment: [],
  quality: [],
  grade: [],
  blessings: [],
  certaintyPct: DEFAULT_CERTAINTY_PCT,
};

/** Whether any accepted-outcome filter is set (certainty alone doesn't count). */
export function hasAnyFilter(filters: OracleFilters): boolean {
  return Boolean(
    filters.equipment.length
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

/** Join a list the way a person would speak it: "a", "a and b", "a, b, and c". */
export function joinHuman(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
