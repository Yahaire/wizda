import { describe, expect, it } from 'vitest';

import { wizda } from './voice';
import { wizdaLinesEn } from './voice.en';

/**
 * Every leaf in the catalog must yield non-empty text — a filled-in string, or a
 * function that returns one for sample args. This is the guard a future locale
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

describe('wizda voice catalog', () => {
  it('has non-empty text for every line in the active locale', () => {
    checkLeaves(wizda, '');
  });

  it('exposes the English locale as the active one', () => {
    expect(wizda).toBe(wizdaLinesEn);
  });
});
