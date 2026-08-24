import { describe, expect, it } from 'vitest';

import { BLESSINGS } from './stats';
import {
  getStoneBlessingGroup,
  getStoneValueRange,
  STONE_BLESSING_GROUPS,
  StoneBlessingGroupKind,
} from './stoneValues';

describe('STONE_BLESSING_GROUPS', () => {
  it('carries all four bands, each with a range per star rating', () => {
    expect(STONE_BLESSING_GROUPS).toHaveLength(4);
    for (const group of STONE_BLESSING_GROUPS) {
      expect(group.rangesByStoneQuality, group.name).toHaveLength(5);
    }
  });

  it('has a non-decreasing, non-empty range at every star rating', () => {
    for (const group of STONE_BLESSING_GROUPS) {
      for (const [index, range] of group.rangesByStoneQuality.entries()) {
        const label = `${group.name} ★${index + 1}`;
        expect(range.minValue, label).toBeGreaterThan(0);
        expect(range.maxValue, label).toBeGreaterThanOrEqual(range.minValue);
      }
    }
  });
});

describe('getStoneBlessingGroup', () => {
  it('partitions all 19 blessings exactly and totally', () => {
    // The check that catches a blessing being added upstream without anyone
    // deciding which stone band it belongs to.
    const counts = new Map<StoneBlessingGroupKind, number>();
    for (const blessing of BLESSINGS) {
      const kind = getStoneBlessingGroup(blessing.code);
      expect(kind, blessing.code).not.toBeNull();
      counts.set(kind!, (counts.get(kind!) ?? 0) + 1);
    }

    expect(BLESSINGS).toHaveLength(19);
    expect(counts.get(StoneBlessingGroupKind.FLAT)).toBe(8);
    expect(counts.get(StoneBlessingGroupKind.PERCENT)).toBe(8);
    expect(counts.get(StoneBlessingGroupKind.ASPD_SUR)).toBe(2);
    expect(counts.get(StoneBlessingGroupKind.ASPD_PERCENT)).toBe(1);
    expect([...counts.values()].reduce((sum, n) => sum + n, 0)).toBe(BLESSINGS.length);
  });

  it('groups ASPD and SUR together, unlike the drop tables', () => {
    expect(getStoneBlessingGroup('ASPD')).toBe(StoneBlessingGroupKind.ASPD_SUR);
    expect(getStoneBlessingGroup('SUR')).toBe(StoneBlessingGroupKind.ASPD_SUR);
  });

  it('keeps ASPD% in its own band, apart from the other percentage blessings', () => {
    expect(getStoneBlessingGroup('ASPD_PER')).toBe(StoneBlessingGroupKind.ASPD_PERCENT);
    expect(getStoneBlessingGroup('ATK_PER')).toBe(StoneBlessingGroupKind.PERCENT);
  });

  it('puts an ordinary flat blessing in the flat band', () => {
    expect(getStoneBlessingGroup('ATK')).toBe(StoneBlessingGroupKind.FLAT);
    expect(getStoneBlessingGroup('MDEF')).toBe(StoneBlessingGroupKind.FLAT);
  });

  it('returns null for an unrecognised blessing code', () => {
    expect(getStoneBlessingGroup('LUCK')).toBeNull();
  });
});

describe('getStoneValueRange', () => {
  it('returns the documented range for each band at 3★', () => {
    expect(getStoneValueRange('ATK', 3)).toEqual({ minValue: 3, maxValue: 5 });
    expect(getStoneValueRange('ATK_PER', 3)).toEqual({ minValue: 2, maxValue: 4 });
    expect(getStoneValueRange('ASPD', 3)).toEqual({ minValue: 3, maxValue: 4 });
    expect(getStoneValueRange('SUR', 3)).toEqual({ minValue: 3, maxValue: 4 });
    expect(getStoneValueRange('ASPD_PER', 3)).toEqual({ minValue: 2, maxValue: 4 });
  });

  it('matches the 3★ flat value docs/milestone-blessings.md already cites', () => {
    // That doc's Alteration section quotes "guide: 3★ flat 3-5" when explaining
    // why altering a slot that already held something feels like a downgrade.
    expect(getStoneValueRange('ATK', 3)).toEqual({ minValue: 3, maxValue: 5 });
  });

  it('spans ★1 through ★5 for a flat blessing', () => {
    expect(getStoneValueRange('ATK', 1)).toEqual({ minValue: 1, maxValue: 3 });
    expect(getStoneValueRange('ATK', 5)).toEqual({ minValue: 5, maxValue: 7 });
  });

  it('returns null for a star rating outside 1-5', () => {
    expect(getStoneValueRange('ATK', 0)).toBeNull();
    expect(getStoneValueRange('ATK', 6)).toBeNull();
  });

  it('returns null for an unrecognised blessing code', () => {
    expect(getStoneValueRange('LUCK', 3)).toBeNull();
  });
});
