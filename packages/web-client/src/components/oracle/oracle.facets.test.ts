import { describe, expect, it } from 'vitest';

import { EquipmentRankKind } from '@shared/domain/rank';

import {
    availableBlessings, availableOn, candidateEquipment, computeFacets, detectConflict,
    longestSatisfiableBlessings, maxReachableGrade, satisfyingEquipment
} from './oracle.facets';
import { EMPTY_FILTERS, MAX_LEVEL, OracleFilters } from './oracle.logic';

import type { EquipmentListItem } from '@shared/api/endpoints/lists.models';

function filters(overrides: Partial<OracleFilters> = {}): OracleFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

const SWORD = { code: 'SWORD', name: 'Sword' };
const HEAVY_ARMOR = { code: 'HEAVY_ARMOR', name: 'Heavy Armor' };

function gear(
  name: string,
  overrides: Partial<EquipmentListItem> = {},
): EquipmentListItem {
  return {
    name,
    category: null,
    rank: null,
    maxDropQuality: MAX_LEVEL,
    maxDropGrade: MAX_LEVEL,
    blessings: [],
    sources: [],
    ...overrides,
  };
}

// A sword never rolls DEF; plate never rolls ATK. The two mail pieces differ only
// in rank, which is what the equipment-vs-rank interdependency turns on.
const SWORD_BLESSINGS = ['ATK', 'ATK_PER', 'ACC', 'SUR'];
const BRONZE_SWORD = gear('Bronze Sword', {
  category: SWORD,
  rank: EquipmentRankKind.BRONZE,
  maxDropGrade: 4,
  maxDropQuality: 4,
  blessings: SWORD_BLESSINGS,
});
const SILVER_SWORD = gear('Silver Sword', {
  category: SWORD,
  rank: EquipmentRankKind.SILVER,
  blessings: SWORD_BLESSINGS,
});
const SILVER_MAIL = gear('Silver Mail', {
  category: HEAVY_ARMOR,
  rank: EquipmentRankKind.SILVER,
  blessings: ['DEF', 'MDEF', 'SUR'],
});
const NAMELESS = gear('Nameless Thing', { blessings: ['ATK', 'DEF'] });

const CATALOG = [BRONZE_SWORD, SILVER_SWORD, SILVER_MAIL, NAMELESS];

describe('candidateEquipment', () => {
  it('is the whole catalog while the identity axes are blank', () => {
    expect(candidateEquipment(CATALOG, filters())).toEqual(CATALOG);
  });

  it('ANDs the three axes, as the API does', () => {
    const narrowed = candidateEquipment(CATALOG, filters({
      category: ['SWORD'],
      rank: [EquipmentRankKind.SILVER],
    }));

    expect(narrowed).toEqual([SILVER_SWORD]);
  });

  it('is empty for the contradiction the greying-out exists to prevent', () => {
    expect(candidateEquipment(CATALOG, filters({
      equipment: ['Bronze Sword'],
      rank: [EquipmentRankKind.SILVER],
    }))).toEqual([]);
  });

  it('drops an unclassified piece the moment rank or category is asked for', () => {
    // Prisma can't match `null` against an `IN` list either, so this mirrors the API.
    expect(candidateEquipment(CATALOG, filters({ rank: [EquipmentRankKind.SILVER] })))
      .not.toContain(NAMELESS);
    expect(candidateEquipment(CATALOG, filters())).toContain(NAMELESS);
  });
});

describe('availableOn', () => {
  it('offers every value while nothing else is picked', () => {
    expect(availableOn(CATALOG, filters(), 'rank'))
      .toEqual(new Set([EquipmentRankKind.BRONZE, EquipmentRankKind.SILVER]));
  });

  it('withholds a rank no picked piece comes in — and the piece no picked rank admits', () => {
    expect(availableOn(CATALOG, filters({ equipment: ['Bronze Sword'] }), 'rank'))
      .toEqual(new Set([EquipmentRankKind.BRONZE]));
    expect(availableOn(CATALOG, filters({ rank: [EquipmentRankKind.SILVER] }), 'equipment'))
      .toEqual(new Set(['Silver Sword', 'Silver Mail']));
  });

  it('judges an axis against the others only, so a second pick on it always widens', () => {
    // Silver is already asked for; Bronze must stay offered, since taking it can
    // only add candidates back — the OR within an axis never narrows.
    const withSilver = filters({ rank: [EquipmentRankKind.SILVER] });

    expect(availableOn(CATALOG, withSilver, 'rank')).toContain(EquipmentRankKind.BRONZE);
  });

  it('withholds a category once the rank rules its every piece out', () => {
    expect(availableOn(CATALOG, filters({ rank: [EquipmentRankKind.BRONZE] }), 'category'))
      .toEqual(new Set(['SWORD']));
  });
});

describe('satisfyingEquipment', () => {
  it('is every candidate when no blessing is required', () => {
    expect(satisfyingEquipment(CATALOG, [])).toEqual(CATALOG);
  });

  it('keeps only pieces carrying the whole AND set — never two pieces between them', () => {
    expect(satisfyingEquipment([BRONZE_SWORD, SILVER_MAIL], ['ATK'])).toEqual([BRONZE_SWORD]);
    // ATK lives on the sword and DEF on the mail, but neither piece has both.
    expect(satisfyingEquipment([BRONZE_SWORD, SILVER_MAIL], ['ATK', 'DEF'])).toEqual([]);
    expect(satisfyingEquipment(CATALOG, ['ATK', 'DEF'])).toEqual([NAMELESS]);
  });
});

describe('availableBlessings', () => {
  it('is the union of what the candidates roll when nothing is required yet', () => {
    expect(availableBlessings([BRONZE_SWORD, SILVER_MAIL], []))
      .toEqual(new Set([...SWORD_BLESSINGS, 'DEF', 'MDEF']));
  });

  it('offers only what some piece can roll alongside the current picks', () => {
    // Requiring ATK leaves the sword; DEF is no longer reachable, ACC still is.
    const available = availableBlessings([BRONZE_SWORD, SILVER_MAIL], ['ATK']);

    expect(available.has('ACC')).toBe(true);
    expect(available.has('DEF')).toBe(false);
  });
});

describe('longestSatisfiableBlessings', () => {
  it('keeps every pick the gear can still carry, dropping only the ones it cannot', () => {
    expect(longestSatisfiableBlessings([BRONZE_SWORD], ['ATK', 'DEF', 'ACC'])).toEqual(['ATK', 'ACC']);
    expect(longestSatisfiableBlessings([BRONZE_SWORD], ['DEF'])).toEqual([]);
  });
});

describe('detectConflict', () => {
  const conflictFor = (overrides: Partial<OracleFilters>) => {
    const selection = filters(overrides);
    const candidates = candidateEquipment(CATALOG, selection);
    return detectConflict(candidates, satisfyingEquipment(candidates, selection.blessings), selection);
  };

  it('finds nothing wrong with a selection that fits', () => {
    expect(conflictFor({ equipment: ['Silver Sword'], minGrade: 5, blessings: ['ATK'] })).toBeNull();
  });

  it('rescues an identity contradiction by dropping the category and rank', () => {
    const conflict = conflictFor({
      equipment: ['Bronze Sword'],
      rank: [EquipmentRankKind.SILVER],
    });

    expect(conflict?.fix).toEqual({ category: [], rank: [] });
  });

  it('names the blessing the chosen gear never rolls, and trims it away', () => {
    const conflict = conflictFor({ equipment: ['Bronze Sword'], blessings: ['ATK', 'DEF'] });

    expect(conflict?.message).toContain("ever rolls DEF");
    expect(conflict?.fix).toEqual({ blessings: ['ATK'] });
  });

  it('distinguishes a combination no one piece carries from a blessing no one rolls', () => {
    // Each is rollable on its own — just never together on a single piece.
    const conflict = conflictFor({ category: ['SWORD', 'HEAVY_ARMOR'], blessings: ['ATK', 'DEF'] });

    expect(conflict?.message).toContain('No single piece');
    expect(conflict?.fix).toEqual({ blessings: ['ATK'] });
  });

  it('offers no fix when the blessings need a grade the gear never drops', () => {
    // Four blessings need four active slots, so only Red will do — and the
    // Bronze Sword tops out at Purple. No grade both fits and drops.
    const conflict = conflictFor({ equipment: ['Bronze Sword'], blessings: SWORD_BLESSINGS });

    expect(conflict?.fix).toBeNull();
    expect(conflict?.message).toContain('never drops that high');
  });

  it('lowers a minimum that overshoots what the gear drops', () => {
    const conflict = conflictFor({ equipment: ['Bronze Sword'], minGrade: 5, minQuality: 5 });

    expect(conflict?.fix).toEqual({ minGrade: 4, minQuality: 4 });
  });

  it('reads the ceilings off the gear that could answer the query, not every candidate', () => {
    // Both are candidates and the mail reaches Red, but only the Bronze Sword can
    // roll ATK — so Red is out of reach and the grade minimum has to come down.
    const selection = filters({ blessings: ['ATK'], minGrade: 5 });
    const candidates = [BRONZE_SWORD, SILVER_MAIL];

    expect(detectConflict(candidates, satisfyingEquipment(candidates, ['ATK']), selection)?.fix)
      .toEqual({ minGrade: 4, minQuality: 1 });
  });
});

describe('computeFacets', () => {
  it('withholds nothing and claims no conflict before the catalog lands', () => {
    const facets = computeFacets(null, filters({ minGrade: 5, blessings: ['ATK', 'DEF'] }));

    expect(facets.conflict).toBeNull();
    expect(facets.maxGrade).toBe(MAX_LEVEL);
    expect(facets.blessings.has('DEF')).toBe(true);
  });

  it('caps the grade slider at what the surviving gear drops', () => {
    expect(computeFacets(CATALOG, filters({ equipment: ['Bronze Sword'] })).maxGrade).toBe(4);
    expect(computeFacets(CATALOG, filters({ rank: [EquipmentRankKind.SILVER] })).maxGrade)
      .toBe(MAX_LEVEL);
  });

  it('raises the blessing conflict when no surviving piece can roll what was asked', () => {
    const facets = computeFacets(CATALOG, filters({ category: ['SWORD'], blessings: ['MDEF'] }));

    expect(facets.conflict?.fix).toEqual({ blessings: [] });
  });

  it('offers only the categories the catalog actually has, whatever the picks narrow to', () => {
    // Nothing in the catalog is a Dagger, so a Dagger is never worth offering —
    // that's how Tools stay off the real menu without being named anywhere.
    const facets = computeFacets(CATALOG, filters({ rank: [EquipmentRankKind.BRONZE] }));

    expect(facets.catalogCategory).toEqual(new Set(['SWORD', 'HEAVY_ARMOR']));
    // ...while `category` still narrows to what the Bronze pick leaves.
    expect(facets.category).toEqual(new Set(['SWORD']));
  });

  it('ignores remembered gear the catalog no longer has, rather than calling it a conflict', () => {
    // The page prunes these a render later; a prompt about vanished gear helps nobody.
    const facets = computeFacets(CATALOG, filters({ equipment: ['Gear From A Past Scrape'] }));

    expect(facets.conflict).toBeNull();
    expect(facets.rank).toEqual(new Set([EquipmentRankKind.BRONZE, EquipmentRankKind.SILVER]));
  });

  it('greys out the gear that fits neither the category nor the rank picks', () => {
    const facets = computeFacets(CATALOG, filters({ rank: [EquipmentRankKind.BRONZE] }));

    expect(facets.equipment).toEqual(new Set(['Bronze Sword']));
  });
});

describe('maxReachableGrade', () => {
  it('takes the best any piece reaches, since the guarantee ORs across equipment', () => {
    expect(maxReachableGrade([BRONZE_SWORD, SILVER_SWORD])).toBe(MAX_LEVEL);
    expect(maxReachableGrade([BRONZE_SWORD])).toBe(4);
  });

  it('does not over-constrain on missing data, nor on no data at all', () => {
    expect(maxReachableGrade([gear('Unknown', { maxDropGrade: null })])).toBe(MAX_LEVEL);
    expect(maxReachableGrade([])).toBe(MAX_LEVEL);
  });
});
