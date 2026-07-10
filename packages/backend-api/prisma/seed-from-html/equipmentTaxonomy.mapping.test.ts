import { describe, expect, it } from 'vitest';

import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';
import { EquipmentRankKind } from '@shared/domain/rank';

import {
  ARMOR_TYPE_TO_CATEGORY,
  WEAPON_TYPE_TO_CATEGORY,
  armorCategoryCode,
  buildTaxonomyByName,
  rankToKind,
  weaponCategoryCode,
} from './equipmentTaxonomy.mapping';

const VALID_CATEGORY_CODES = new Set(EQUIPMENT_CATEGORIES.map((category) => category.code));

describe('rankToKind', () => {
  it('maps every source rank to a rank', () => {
    expect(rankToKind('Worn')).toBe(EquipmentRankKind.WORN);
    expect(rankToKind('Bronze')).toBe(EquipmentRankKind.BRONZE);
    expect(rankToKind('Iron')).toBe(EquipmentRankKind.IRON);
    expect(rankToKind('Steel')).toBe(EquipmentRankKind.STEEL);
    expect(rankToKind('Ebonsteel')).toBe(EquipmentRankKind.EBONSTEEL);
    expect(rankToKind('Silver')).toBe(EquipmentRankKind.SILVER);
  });

  it('throws on an unknown rank', () => {
    expect(() => rankToKind('Mythril')).toThrow(/Unknown equipment rank/);
  });

  it('throws on "Ex." — that marker lives in Compendium Number, never in Rank', () => {
    expect(() => rankToKind('Ex.')).toThrow(/Unknown equipment rank/);
  });
});

describe('weaponCategoryCode', () => {
  it('maps every weapon Type to a real category code', () => {
    for (const [type, code] of Object.entries(WEAPON_TYPE_TO_CATEGORY)) {
      expect(weaponCategoryCode(type), type).toBe(code);
      expect(VALID_CATEGORY_CODES.has(code), code).toBe(true);
    }
  });

  it('maps the once-missing 2H_Spear to the new category', () => {
    expect(weaponCategoryCode('2H_Spear')).toBe('TWO_HANDED_SPEAR');
  });

  it('throws on an unknown weapon type', () => {
    expect(() => weaponCategoryCode('Whip')).toThrow(/Unknown weapon type/);
  });
});

describe('armorCategoryCode', () => {
  it('maps every (Type, Armor Type) pair to a real category code', () => {
    for (const [type, byArmorType] of Object.entries(ARMOR_TYPE_TO_CATEGORY)) {
      for (const [armorType, code] of Object.entries(byArmorType)) {
        expect(armorCategoryCode(type, armorType), `${type}/${armorType}`).toBe(code);
        expect(VALID_CATEGORY_CODES.has(code), code).toBe(true);
      }
    }
  });

  it('maps a shield weight to the right shield category', () => {
    expect(armorCategoryCode('Shield', 'Cloth')).toBe('SMALL_SHIELD');
    expect(armorCategoryCode('Shield', 'Heavy')).toBe('HEAVY_SHIELD');
  });

  it('throws on an unknown Type or Armor Type', () => {
    expect(() => armorCategoryCode('Cape', 'Cloth')).toThrow(/Unknown armor Type/);
    expect(() => armorCategoryCode('Head', 'Plated')).toThrow(/Unknown Armor Type/);
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

    const byName = buildTaxonomyByName(weaponRows, armorRows);

    expect(byName.get('Bronze Dagger')).toEqual({ categoryCode: 'DAGGER', rank: EquipmentRankKind.BRONZE });
    expect(byName.get('Blade Cuisinart')).toEqual({ categoryCode: 'ONE_HANDED_SWORD', rank: EquipmentRankKind.EBONSTEEL });
    expect(byName.get('Cloth Hat')).toEqual({ categoryCode: 'HAT', rank: EquipmentRankKind.WORN });
    expect(byName.get('Grip Gloves')).toEqual({ categoryCode: null, rank: EquipmentRankKind.SILVER });
    expect(byName.size).toBe(4);
  });
});
