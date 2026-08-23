import { describe, expect, it } from 'vitest';

import { EQUIPMENT_CATEGORIES } from '@shared/domain/equipment';

import { BlessingValueSelectorKind } from './blessingValueRates.models';
import { parseValueGroupHeading } from './valueGroupHeading';

/** The 15 pieces verbatim from the real "Equipment Rank 6 (Librarian Rod, …)" heading. */
const NAMED_EQUIPMENT = new Set([
  'Librarian Rod', 'Citrus-Blossom Hairpin', 'Red Spinner Scissor Staff', 'Winterthorn Bell Bow',
  'Glasses of Calm', 'Winterthorn Wreath', 'Floral Uchikake', 'Robe of the Millenium',
  'Heavy Armor of Bloodrage', 'Red Spinner Woman Spellwoven Cloth', 'High Boots of the Winter Night',
  'Dreamblossom Ornament', 'Ring of Torment Purging', 'Master Ring', 'Dream-Cutting Scissors',
]);

describe('parseValueGroupHeading', () => {
  it('resolves "Equipment Rank 1-5" as a rank-range group', () => {
    const { selector, unknownTokens } = parseValueGroupHeading('Equipment Rank 1-5', NAMED_EQUIPMENT);

    expect(selector.code).toBe('RANK_1_5');
    expect(selector.kind).toBe(BlessingValueSelectorKind.RANK_RANGE);
    expect(selector.rankOrderMin).toBe(1);
    expect(selector.rankOrderMax).toBe(5);
    expect(selector.tokens).toEqual([]);
    expect(unknownTokens).toEqual([]);
  });

  it('resolves the named-pieces heading, tolerating the source\'s double-space separators', () => {
    const heading =
      'Equipment Rank 6 (Librarian Rod,  Citrus-Blossom Hairpin,  Red Spinner Scissor Staff,  '
      + 'Winterthorn Bell Bow,  Glasses of Calm,  Winterthorn Wreath,  Floral Uchikake,  '
      + 'Robe of the Millenium,  Heavy Armor of Bloodrage,  Red Spinner Woman Spellwoven Cloth,  '
      + 'High Boots of the Winter Night,  Dreamblossom Ornament,  Ring of Torment Purging,  '
      + 'Master Ring,  Dream-Cutting Scissors)';

    const { selector, unknownTokens } = parseValueGroupHeading(heading, NAMED_EQUIPMENT);

    expect(selector.code).toBe('RANK_6_NAMED');
    expect(selector.kind).toBe(BlessingValueSelectorKind.NAMED);
    expect(selector.tokens).toHaveLength(15);
    expect(selector.tokens).toContain('Master Ring');
    expect(unknownTokens).toEqual([]);
  });

  it('resolves the 2H-melee heading as a category group', () => {
    const heading = 'Equipment Rank 6 (Two-Handed Sword, Two-Handed Spear, Two-Handed Axe, '
      + 'Two-Handed Blunt Weapon, Odachi, Cesti)';

    const { selector, unknownTokens } = parseValueGroupHeading(heading, NAMED_EQUIPMENT);

    expect(selector.code).toBe('RANK_6_CATEGORY');
    expect(selector.kind).toBe(BlessingValueSelectorKind.CATEGORY);
    expect(selector.tokens).toEqual([
      'TWO_HANDED_SWORD', 'TWO_HANDED_SPEAR', 'TWO_HANDED_AXE',
      'TWO_HANDED_BLUNT_WEAPON', 'ODACHI', 'CESTI',
    ]);
    expect(unknownTokens).toEqual([]);
  });

  it('resolves the "Excluding weapons listed above" heading as fallback', () => {
    const { selector } = parseValueGroupHeading(
      'Equipment Rank 6 (Excluding weapons listed above)',
      NAMED_EQUIPMENT,
    );

    expect(selector.code).toBe('RANK_6_FALLBACK');
    expect(selector.kind).toBe(BlessingValueSelectorKind.FALLBACK);
    expect(selector.tokens).toEqual([]);
  });

  it('requires every token to match a category before accepting a CATEGORY match', () => {
    const { selector, unknownTokens } = parseValueGroupHeading(
      'Equipment Rank 6 (Bow, Nonexistent Category)',
      NAMED_EQUIPMENT,
    );

    expect(selector.kind).toBe(BlessingValueSelectorKind.UNKNOWN);
    expect(selector.tokens).toEqual(['Bow', 'Nonexistent Category']);
    expect(unknownTokens).toEqual(['Bow', 'Nonexistent Category']);
  });

  it('keeps the full token list on a partial match — an unrecognised name is reported, not dropped', () => {
    const { selector, unknownTokens } = parseValueGroupHeading(
      'Equipment Rank 6 (Master Ring, Some New Banner Piece)',
      NAMED_EQUIPMENT,
    );

    // Membership is published in the heading, so a name we haven't seeded yet
    // still belongs to the group — only `unknownTokens` flags it as unresolved.
    expect(selector.kind).toBe(BlessingValueSelectorKind.NAMED);
    expect(selector.tokens).toEqual(['Master Ring', 'Some New Banner Piece']);
    expect(unknownTokens).toEqual(['Some New Banner Piece']);
  });

  it('classifies as UNKNOWN when no token matches a category or a known equipment name', () => {
    const { selector, unknownTokens } = parseValueGroupHeading(
      'Equipment Rank 6 (Something Nobody Has Seen)',
      NAMED_EQUIPMENT,
    );

    expect(selector.kind).toBe(BlessingValueSelectorKind.UNKNOWN);
    expect(selector.tokens).toEqual(['Something Nobody Has Seen']);
    expect(unknownTokens).toEqual(['Something Nobody Has Seen']);
  });

  it('classifies as UNKNOWN when the rank ordinal itself is unrecognised, without throwing', () => {
    const { selector } = parseValueGroupHeading('Equipment Rank 7', NAMED_EQUIPMENT);

    expect(selector.kind).toBe(BlessingValueSelectorKind.UNKNOWN);
    expect(selector.code).toBe('RANK_7_UNKNOWN');
  });

  it('classifies as UNKNOWN when the heading does not even match the "Equipment Rank" shape', () => {
    const { selector } = parseValueGroupHeading('Something Else Entirely', NAMED_EQUIPMENT);

    expect(selector.kind).toBe(BlessingValueSelectorKind.UNKNOWN);
    expect(selector.rankOrderMin).toBe(0);
    expect(selector.rankOrderMax).toBe(0);
    expect(selector.code).toBe('SOMETHING_ELSE_ENTIRELY');
  });

  it('every EQUIPMENT_CATEGORIES name round-trips through the category-token match', () => {
    for (const category of EQUIPMENT_CATEGORIES) {
      const { selector } = parseValueGroupHeading(`Equipment Rank 6 (${category.name})`, NAMED_EQUIPMENT);
      expect(selector.kind, category.name).toBe(BlessingValueSelectorKind.CATEGORY);
      expect(selector.tokens, category.name).toEqual([category.code]);
    }
  });
});
