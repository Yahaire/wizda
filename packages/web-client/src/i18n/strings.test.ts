import { describe, expect, it } from 'vitest';

import { EQUIPMENT_CATEGORIES, EQUIPMENT_TYPES } from '@shared/domain/equipment';
import { EQUIPMENT_RANKS } from '@shared/domain/rank';

import { uiStringsEn } from './strings.en';
import { uiStringsJa } from './strings.ja';

/**
 * Every static leaf must be a non-empty string; every dynamic leaf must be a
 * function present in the catalog. Unlike the Wizda voice guard, we don't invoke
 * the functions here — their args are heterogeneous (arrays, counts, labels), so
 * `satisfies UiStrings` (compile time) and the components that call them are what
 * pin their return shape. This still catches a blank or missing entry.
 */
function checkLeaves(value: unknown, path: string): void {
  if (typeof value === 'string') {
    expect(value.trim(), `empty string at ${path}`).not.toBe('');
    return;
  }
  if (typeof value === 'function') {
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      checkLeaves(child, path ? `${path}.${key}` : key);
    }
    return;
  }
  throw new Error(`unexpected leaf type at ${path}: ${typeof value}`);
}

/** The set of leaf paths in an object, so two locales can be compared for parity. */
function leafPaths(value: unknown, path: string, out: Set<string>): void {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      leafPaths(child, path ? `${path}.${key}` : key, out);
    }
    return;
  }
  out.add(path);
}

const LOCALES = {
  en: uiStringsEn,
  ja: uiStringsJa,
};

describe('UI string catalog', () => {
  for (const [name, catalog] of Object.entries(LOCALES)) {
    it(`has non-empty text for every entry in ${name}`, () => {
      checkLeaves(catalog, '');
    });
  }

  it('keeps every locale in structural parity with English', () => {
    const reference = new Set<string>();
    leafPaths(uiStringsEn, '', reference);
    for (const [name, catalog] of Object.entries(LOCALES)) {
      const paths = new Set<string>();
      leafPaths(catalog, '', paths);
      expect([...paths].sort(), `${name} leaf shape`).toEqual([...reference].sort());
    }
  });
});

/**
 * The taxonomy tables are the source of truth; these catalogs must keep up with
 * them. `Record<EquipmentCategoryCode, string>` already makes a *missing* entry a
 * compile error, but only for a code that reached `EQUIPMENT_CATEGORIES` — these
 * tests fail with the runbook named in the message, which a type error can't do.
 * See "Adding a new equipment category" in docs/domain.md.
 */
describe('vocabulary covers the shared taxonomy', () => {
  const RUNBOOK = 'add it to every locale — see "Adding a new equipment category" in docs/domain.md';

  for (const [name, catalog] of Object.entries(LOCALES)) {
    it(`names every equipment category in ${name}`, () => {
      for (const category of EQUIPMENT_CATEGORIES) {
        const label = catalog.vocab.categoryName[category.code];
        expect(label?.trim(), `${name} is missing a name for ${category.code} — ${RUNBOOK}`)
          .toBeTruthy();
      }
    });

    it(`names every equipment type in ${name}`, () => {
      for (const type of EQUIPMENT_TYPES) {
        const label = catalog.vocab.equipmentTypeName[type.kind];
        expect(label?.trim(), `${name} is missing a name for ${type.kind} — ${RUNBOOK}`)
          .toBeTruthy();
      }
    });

    it(`names every equipment rank in ${name}`, () => {
      for (const rank of EQUIPMENT_RANKS) {
        const label = catalog.vocab.rankName[rank.kind];
        expect(label?.trim(), `${name} is missing a name for ${rank.kind} — ${RUNBOOK}`)
          .toBeTruthy();
      }
    });
  }
});
