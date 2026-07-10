import { describe, expect, it } from 'vitest';

import { createSearchMatcher } from './search';

describe('createSearchMatcher', () => {
  const matches = (query: string, text: string) => createSearchMatcher(query)(text);

  it('matches every term in any order', () => {
    expect(matches('silver axe', 'Silver Two-Handed Axe')).toBe(true);
    expect(matches('axe silver', 'Silver Two-Handed Axe')).toBe(true);
    expect(matches('bronze axe', 'Silver Two-Handed Axe')).toBe(false);
  });

  it('matches everything on an empty or blank query', () => {
    expect(matches('', 'Silver Two-Handed Axe')).toBe(true);
    expect(matches('   ', 'Silver Two-Handed Axe')).toBe(true);
  });

  it('ignores case and punctuation on both sides', () => {
    expect(matches('TWO-HANDED', 'Silver Two-Handed Axe')).toBe(true);
    expect(matches('twohanded', 'Silver Two-Handed Axe')).toBe(true);
    expect(matches('two-handed', 'Silver TwoHanded Axe')).toBe(true);
    expect(matches("goddess's", 'Goddesss Earrings')).toBe(true);
    expect(matches('goddesss', "Goddess's Earrings")).toBe(true);
  });

  it('never lets a term straddle two words', () => {
    expect(matches('verdrop', 'Bow of the Water Drop')).toBe(false);
  });

  it('expands hand abbreviations', () => {
    expect(matches('2h', 'Silver Two-Handed Axe')).toBe(true);
    expect(matches('1h', 'Silver Two-Handed Axe')).toBe(false);
    expect(matches('1h', 'One-Handed Staff')).toBe(true);
    expect(matches('1-h axe', 'Bronze One-Handed Axe')).toBe(true);
  });

  it('expands aliases only as whole terms', () => {
    expect(matches('1hp', 'One-Handed Staff')).toBe(false);
  });

  it('finds names the game shortens to "Helm"', () => {
    expect(matches('helmet', 'Red Fired Heavy Helm')).toBe(true);
    expect(matches('helm', 'Silver Light Helmet')).toBe(true);
  });

  it('accepts the British spelling of armor', () => {
    expect(matches('armour', 'Iron Light Armor')).toBe(true);
    expect(matches('light armour boots', 'Silver Light Armor Boots')).toBe(true);
  });

  it('finds a blade by the adventurer players associate it with', () => {
    expect(matches('lana', 'Blade Cuisinart')).toBe(true);
    expect(matches('lana blade', 'Blade Cuisinart')).toBe(true);
    expect(matches('lana', 'Demonbane Dagger')).toBe(false);
  });

  it('does not alias in reverse', () => {
    expect(matches('onehanded', 'Bronze 1h Axe')).toBe(false);
  });
});
