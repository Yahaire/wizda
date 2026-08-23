import { describe, expect, it } from 'vitest';

import { BLESSINGS } from '@shared/domain/stats';

import { parseBlessingLabel } from './blessingLabels';

describe('parseBlessingLabel', () => {
  it('parses every catalog blessing back to its code, flat and percent', () => {
    for (const blessing of BLESSINGS) {
      const variant = blessing.isPercent ? '%' : 'fixed';
      const label = `${blessing.statKind} Increase (${variant})`;
      expect(parseBlessingLabel(label), label).toBe(blessing.code);
    }
  });

  it('matches real source strings verbatim', () => {
    expect(parseBlessingLabel('ATK Increase (%)')).toBe('ATK_PER');
    expect(parseBlessingLabel('SUR Increase (fixed)')).toBe('SUR');
    expect(parseBlessingLabel('ASPD Increase (fixed)')).toBe('ASPD');
  });

  it('trims surrounding whitespace, matching how a table cell is read', () => {
    expect(parseBlessingLabel('  ATK Increase (%)  ')).toBe('ATK_PER');
  });

  it('returns null for an unrecognised stat name', () => {
    expect(parseBlessingLabel('LUCK Increase (%)')).toBeNull();
  });

  it('returns null for a differently-shaped label', () => {
    expect(parseBlessingLabel('ATK Increase')).toBeNull();
    expect(parseBlessingLabel('Additional Blessing Slots')).toBeNull();
  });

  it('returns null for an unrecognised variant', () => {
    expect(parseBlessingLabel('ATK Increase (double)')).toBeNull();
  });
});
