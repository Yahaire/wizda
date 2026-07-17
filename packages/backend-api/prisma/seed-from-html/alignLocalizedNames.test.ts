import { describe, expect, it } from 'vitest';

import { alignLocalizedNames } from './alignLocalizedNames';
import { ParsedJunkDropRow } from './dropRatesByJunk.models';

function row(overrides: Partial<ParsedJunkDropRow> = {}): ParsedJunkDropRow {
  return {
    junkName: 'Beginning Junk',
    groupNumber: 1,
    groupDropRate: 0.5,
    equipmentName: 'Bronze Dagger',
    dropRate: 0.3,
    qualityRates: [0.8, 0.15, 0.05, 0, 0],
    gradeRates: [0.8, 0.15, 0.05, 0, 0],
    ...overrides,
  };
}

describe('alignLocalizedNames', () => {
  it('aligns matching rows and builds english -> localized name maps', () => {
    const english = [
      row(),
      row({ junkName: 'Beginning Junk', equipmentName: 'Thieves\' Boots', groupNumber: 2, groupDropRate: 0.5 }),
    ];
    const localized = [
      row({ junkName: '始まりのガラクタ', equipmentName: '青銅の短剣' }),
      row({
        junkName: '始まりのガラクタ',
        equipmentName: '盗賊のブーツ',
        groupNumber: 2,
        groupDropRate: 0.5,
      }),
    ];

    const result = alignLocalizedNames(english, localized);

    expect(result.aligned).toBe(true);
    if (!result.aligned) {
      throw new Error('expected alignment to succeed');
    }
    expect(result.junkNames.get('Beginning Junk')).toBe('始まりのガラクタ');
    expect(result.equipmentNames.get('Bronze Dagger')).toBe('青銅の短剣');
    expect(result.equipmentNames.get('Thieves\' Boots')).toBe('盗賊のブーツ');
  });

  it('fails closed on a row-count mismatch', () => {
    const result = alignLocalizedNames([row()], [row(), row({ groupNumber: 2 })]);

    expect(result.aligned).toBe(false);
    if (result.aligned) {
      throw new Error('expected alignment to fail');
    }
    expect(result.reason).toMatch(/row count mismatch/);
  });

  it('fails closed when a row\'s drop-rate numbers diverge (page drifted out of sync)', () => {
    const english = [row()];
    const localized = [row({ equipmentName: 'Bronzedolch', dropRate: 0.9 })];

    const result = alignLocalizedNames(english, localized);

    expect(result.aligned).toBe(false);
    if (result.aligned) {
      throw new Error('expected alignment to fail');
    }
    expect(result.reason).toMatch(/row 0: drop-rate numbers differ/);
  });

  it('fails closed when quality/grade rates diverge even if the headline rate matches', () => {
    const english = [row()];
    const localized = [row({ equipmentName: 'Bronzedolch', qualityRates: [0.5, 0.3, 0.1, 0.1, 0] })];

    const result = alignLocalizedNames(english, localized);

    expect(result.aligned).toBe(false);
  });

  it('tolerates float noise within the fingerprint tolerance', () => {
    const english = [row({ dropRate: 0.3 })];
    const localized = [row({ equipmentName: 'Bronzedolch', dropRate: 0.3 + 1e-9 })];

    const result = alignLocalizedNames(english, localized);

    expect(result.aligned).toBe(true);
  });

  it('fails closed when one english name maps to two different localized names', () => {
    const english = [
      row({ junkName: 'Beginning Junk' }),
      row({ junkName: 'Beginning Junk', equipmentName: 'Thieves\' Boots', groupNumber: 2 }),
    ];
    // Same english junk name, but the localized page spells it two different ways —
    // a fingerprint collision this function must not silently paper over.
    const localized = [
      row({ junkName: '始まりのガラクタ', equipmentName: '青銅の短剣' }),
      row({ junkName: '違うガラクタ', equipmentName: '盗賊のブーツ', groupNumber: 2 }),
    ];

    const result = alignLocalizedNames(english, localized);

    expect(result.aligned).toBe(false);
    if (result.aligned) {
      throw new Error('expected alignment to fail');
    }
    expect(result.reason).toMatch(/mapped to two different localized names/);
  });

  it('handles the empty-input case as a trivially aligned, empty result', () => {
    const result = alignLocalizedNames([], []);

    expect(result.aligned).toBe(true);
    if (!result.aligned) {
      throw new Error('expected alignment to succeed');
    }
    expect(result.junkNames.size).toBe(0);
    expect(result.equipmentNames.size).toBe(0);
  });
});
