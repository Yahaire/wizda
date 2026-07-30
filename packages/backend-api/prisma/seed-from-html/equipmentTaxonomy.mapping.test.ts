import { describe, expect, it } from 'vitest';

import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';
import { EquipmentRankKind } from '@shared/domain/rank';

import {
    ARMOR_TYPE_TO_CATEGORY, buildTaxonomyByName, canonicalName, CSV_NAME_ALIASES,
    getArmorCategoryCode, getRankKind, getWeaponCategoryCode, hasTaxonomyDrift,
    WEAPON_TYPE_TO_CATEGORY
} from './equipmentTaxonomy.mapping';

const VALID_CATEGORY_CODES = new Set(EQUIPMENT_CATEGORIES.map((category) => category.code as string));

const NO_DRIFT = {
  weaponTypes: [],
  armorTypes: [],
  armorWeightClasses: [],
  ranks: [],
};

describe('getRankKind', () => {
  it('maps every source rank to a rank', () => {
    expect(getRankKind('Worn')).toBe(EquipmentRankKind.WORN);
    expect(getRankKind('Bronze')).toBe(EquipmentRankKind.BRONZE);
    expect(getRankKind('Iron')).toBe(EquipmentRankKind.IRON);
    expect(getRankKind('Steel')).toBe(EquipmentRankKind.STEEL);
    expect(getRankKind('Ebonsteel')).toBe(EquipmentRankKind.EBONSTEEL);
    expect(getRankKind('Silver')).toBe(EquipmentRankKind.SILVER);
  });

  it('returns null rather than throwing on an unknown rank', () => {
    expect(getRankKind('Mythril')).toBeNull();
  });

  it('returns null on a blank rank', () => {
    expect(getRankKind('')).toBeNull();
  });

  it('returns null for "Ex." — that marker lives in Compendium Number, never in Rank', () => {
    expect(getRankKind('Ex.')).toBeNull();
  });
});

describe('getWeaponCategoryCode', () => {
  it('maps every weapon Type to a real category code', () => {
    for (const [type, code] of Object.entries(WEAPON_TYPE_TO_CATEGORY)) {
      expect(getWeaponCategoryCode(type), type).toBe(code);
      expect(VALID_CATEGORY_CODES.has(code), code).toBe(true);
    }
  });

  it('maps the once-missing 2H_Spear to the new category', () => {
    expect(getWeaponCategoryCode('2H_Spear')).toBe('TWO_HANDED_SPEAR');
  });

  it('returns null rather than throwing on an unknown weapon type', () => {
    expect(getWeaponCategoryCode('Whip')).toBeNull();
  });
});

describe('getArmorCategoryCode', () => {
  it('maps every (Type, Armor Type) pair to a real category code', () => {
    for (const [type, byArmorType] of Object.entries(ARMOR_TYPE_TO_CATEGORY)) {
      for (const [armorType, code] of Object.entries(byArmorType)) {
        expect(getArmorCategoryCode(type, armorType), `${type}/${armorType}`).toBe(code);
        expect(VALID_CATEGORY_CODES.has(code), code).toBe(true);
      }
    }
  });

  it('maps a shield weight to the right shield category', () => {
    expect(getArmorCategoryCode('Shield', 'Cloth')).toBe('SMALL_SHIELD');
    expect(getArmorCategoryCode('Shield', 'Heavy')).toBe('HEAVY_SHIELD');
  });

  it('returns null rather than throwing on an unknown Type or Armor Type', () => {
    expect(getArmorCategoryCode('Cape', 'Cloth')).toBeNull();
    expect(getArmorCategoryCode('Head', 'Plated')).toBeNull();
  });
});

describe('canonicalName', () => {
  it('rewrites the CSV\'s stray-"the" Light Spirit names to the gacha-rate spelling', () => {
    expect(canonicalName('Headcloth of the Light Spirit')).toBe('Headcloth of Light Spirit');
    expect(canonicalName('Heavy Mail of the Light Spirit')).toBe('Heavy Mail of Light Spirit');
  });

  it('passes unaliased names through untouched', () => {
    expect(canonicalName('Bronze Dagger')).toBe('Bronze Dagger');
    // Same CSV block, already spelled without the article — must not be touched.
    expect(canonicalName('Cloak of Light Spirit')).toBe('Cloak of Light Spirit');
    expect(canonicalName('Light Spirit Amulet')).toBe('Light Spirit Amulet');
  });

  it('is idempotent — every alias target is itself unaliased', () => {
    for (const target of Object.values(CSV_NAME_ALIASES)) {
      expect(canonicalName(target), target).toBe(target);
    }
  });
});

describe('buildTaxonomyByName', () => {
  it('builds a name -> { categoryCode, rank } map from weapon + armor rows, skipping blanks', () => {
    const weaponRows = [
      { 'Item Name': 'Bronze Dagger', Type: 'Dagger', Rank: 'Bronze' },
      // Real-world case: an "Ex." item, but that marker is in Compendium Number
      // (not modelled here) — its Rank is a normal rank, Ebonsteel.
      { 'Item Name': 'Blade Cuisinart', Type: '1H_Sword', Rank: 'Ebonsteel' },
      { 'Item Name': '', Type: '', Rank: '' },
    ];
    const armorRows = [
      { 'Item Name': 'Cloth Hat', Type: 'Head', Rank: 'Worn', 'Armor Type': 'Cloth' },
      // Source gap: a real Silver glove with no weight class — rank only, no category.
      { 'Item Name': 'Grip Gloves', Type: 'Hands', Rank: 'Silver', 'Armor Type': '' },
    ];

    const { byName, drift } = buildTaxonomyByName(weaponRows, armorRows);

    expect(byName.get('Bronze Dagger')).toEqual({ categoryCode: 'DAGGER', rank: EquipmentRankKind.BRONZE });
    expect(byName.get('Blade Cuisinart')).toEqual({ categoryCode: 'ONE_HANDED_SWORD', rank: EquipmentRankKind.EBONSTEEL });
    expect(byName.get('Cloth Hat')).toEqual({ categoryCode: 'HAT', rank: EquipmentRankKind.WORN });
    expect(byName.get('Grip Gloves')).toEqual({ categoryCode: null, rank: EquipmentRankKind.SILVER });
    expect(byName.size).toBe(4);
    // A blank weight class is a routine source gap, not drift.
    expect(drift).toEqual(NO_DRIFT);
    expect(hasTaxonomyDrift(drift)).toBe(false);
  });

  it('keys aliased rows by the gacha-rate name, so the junk-sourced row matches', () => {
    const armorRows = [
      {
        'Item Name': 'Headcloth of the Light Spirit',
        Type: 'Head',
        Rank: 'Ebonsteel',
        'Armor Type': 'Cloth',
      },
    ];

    const { byName } = buildTaxonomyByName([], armorRows);

    expect(byName.get('Headcloth of Light Spirit')).toEqual({
      categoryCode: 'HAT',
      rank: EquipmentRankKind.EBONSTEEL,
    });
    expect(byName.has('Headcloth of the Light Spirit')).toBe(false);
  });
});

/**
 * The collab scenario: the game adds a weapon category (or renames a rank) and
 * the CSVs carry values we've never mapped. Everything here used to throw, which
 * aborted the seed mid-run and left the site in maintenance mode.
 */
describe('buildTaxonomyByName — unmapped source values', () => {
  it('stores an item with an unknown weapon Type, minus its category', () => {
    const { byName, drift } = buildTaxonomyByName(
      [{ 'Item Name': 'Gungnir', Type: 'Polearm', Rank: 'Silver' }],
      [],
    );

    // The item survives with everything we *could* derive — this is the whole point.
    expect(byName.get('Gungnir')).toEqual({ categoryCode: null, rank: EquipmentRankKind.SILVER });
    expect(drift.weaponTypes).toEqual(['Polearm']);
    expect(hasTaxonomyDrift(drift)).toBe(true);
  });

  it('separates an unknown armor weight class from an unknown gear slot', () => {
    const { byName, drift } = buildTaxonomyByName([], [
      // Known slot, new weight class — just one more category under HELMET.
      { 'Item Name': 'Plated Circlet', Type: 'Head', Rank: 'Iron', 'Armor Type': 'Plated' },
      // Unknown slot — needs an EquipmentTypeKind migration, so it's reported apart.
      { 'Item Name': 'Traveller Cape', Type: 'Cape', Rank: 'Iron', 'Armor Type': 'Cloth' },
    ]);

    expect(byName.get('Plated Circlet')).toEqual({ categoryCode: null, rank: EquipmentRankKind.IRON });
    expect(byName.get('Traveller Cape')).toEqual({ categoryCode: null, rank: EquipmentRankKind.IRON });
    expect(drift.armorWeightClasses).toEqual(['Head / Plated']);
    expect(drift.armorTypes).toEqual(['Cape']);
  });

  it('keeps the category when only the rank is unrecognised', () => {
    const { byName, drift } = buildTaxonomyByName(
      [{ 'Item Name': 'Mythril Dagger', Type: 'Dagger', Rank: 'Mythril' }],
      [],
    );

    expect(byName.get('Mythril Dagger')).toEqual({ categoryCode: 'DAGGER', rank: null });
    expect(drift.ranks).toEqual(['Mythril']);
    expect(drift.weaponTypes).toEqual([]);
  });

  it('reports each unknown value once, however many rows carry it', () => {
    const weaponRows = Array.from({ length: 50 }, (_, index) => ({
      'Item Name': `Polearm ${index}`,
      Type: 'Polearm',
      Rank: 'Mythril',
    }));

    const { byName, drift } = buildTaxonomyByName(weaponRows, []);

    expect(byName.size).toBe(50);
    expect(drift.weaponTypes).toEqual(['Polearm']);
    expect(drift.ranks).toEqual(['Mythril']);
  });

  it('sorts drift so the report is stable between runs', () => {
    const { drift } = buildTaxonomyByName(
      [
        { 'Item Name': 'A', Type: 'Whip', Rank: 'Bronze' },
        { 'Item Name': 'B', Type: 'Polearm', Rank: 'Bronze' },
        { 'Item Name': 'C', Type: 'Scythe', Rank: 'Bronze' },
      ],
      [],
    );

    expect(drift.weaponTypes).toEqual(['Polearm', 'Scythe', 'Whip']);
  });
});
