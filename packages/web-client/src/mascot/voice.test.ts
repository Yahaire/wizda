import { describe, expect, it } from 'vitest';

import { wizdaLinesEn } from './voice.en';
import { wizdaLinesJa } from './voice.ja';

/**
 * Every leaf in a locale catalog must yield non-empty text — a filled-in string,
 * or a function that returns one for sample args. This is the guard each locale
 * leans on: a missing or blank entry fails here, not silently in the UI.
 */
function checkLeaves(value: unknown, path: string): void {
  if (typeof value === 'string') {
    expect(value.trim(), `empty line at ${path}`).not.toBe('');
    return;
  }
  if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, () => 'sample');
    const out = (value as (...fnArgs: unknown[]) => unknown)(...args);
    expect(typeof out, `${path} should return a string`).toBe('string');
    expect((out as string).trim(), `empty return from ${path}`).not.toBe('');
    return;
  }
  if (Array.isArray(value)) {
    expect(value.length, `empty array at ${path}`).toBeGreaterThan(0);
    value.forEach((item, index) => checkLeaves(item, `${path}[${index}]`));
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
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      leafPaths(child, path ? `${path}.${key}` : key, out);
    }
    return;
  }
  out.add(path);
}

const LOCALES = {
  en: wizdaLinesEn,
  ja: wizdaLinesJa,
};

describe('wizda voice catalog', () => {
  for (const [name, catalog] of Object.entries(LOCALES)) {
    it(`has non-empty text for every line in ${name}`, () => {
      checkLeaves(catalog, '');
    });
  }

  it('keeps every locale in structural parity with English', () => {
    const reference = new Set<string>();
    leafPaths(wizdaLinesEn, '', reference);
    for (const [name, catalog] of Object.entries(LOCALES)) {
      const paths = new Set<string>();
      leafPaths(catalog, '', paths);
      expect([...paths].sort(), `${name} leaf shape`).toEqual([...reference].sort());
    }
  });
});
