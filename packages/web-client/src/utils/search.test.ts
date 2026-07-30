import { describe, expect, it } from 'vitest';

import { createSearchMatcher, normalize } from './search';

describe('createSearchMatcher', () => {
  /** Mirrors what callers do: normalize each candidate once, then test the query against it. */
  const matches = (query: string, ...texts: string[]) =>
    createSearchMatcher(query).matchesNormalized(texts.map(normalize));

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

  describe('Japanese', () => {
    it('treats katakana and hiragana as the same script', () => {
      expect(matches('らいおん', 'ライオンハートシールド')).toBe(true);
      expect(matches('ライオン', 'らいおんはーとしーるど')).toBe(true);
      expect(matches('シールド', 'ライオンハートシールド')).toBe(true);
    });

    it('accepts romaji for a kana name', () => {
      expect(matches('raion', 'ライオンハートシールド')).toBe(true);
      expect(matches('shirudo', 'ライオンハートシールド')).toBe(true);
      expect(matches('raion', '常闇の大剣')).toBe(false);
    });

    it('accepts either romaji spelling of the same sound', () => {
      // juu and jyuu are one word; converting into kana is what makes them converge.
      expect(matches('juu', 'じゅう')).toBe(true);
      expect(matches('jyuu', 'じゅう')).toBe(true);
    });

    it('reaches a kanji name through its stored reading', () => {
      // The reading is the second candidate — exactly what the API sends as
      // `nameReading`. Without it, no amount of folding gets よる to 夜.
      expect(matches('よる', '夜の剣', 'よるのけん')).toBe(true);
      expect(matches('yoru', '夜の剣', 'よるのけん')).toBe(true);
      expect(matches('よる', '夜の剣')).toBe(false);
    });

    it('still matches kanji directly, so a wrong reading only costs a miss', () => {
      // 翠色 is read すいしょく here; a player typing the kanji is unaffected.
      expect(matches('翠色', '風の魔窟の翠色の重防具', 'かぜのまくつのすいしょくのじゅうぼうぐ')).toBe(true);
    });

    it('lets separate terms match the name and the reading independently', () => {
      expect(matches('夜 けん', '夜の剣', 'よるのけん')).toBe(true);
    });

    it('matches a long vowel however it is spelled', () => {
      // One sound, four spellings: ー in the name, doubled kana or a bare vowel
      // in the query, and either of those again in romaji.
      const hood = '薬種の古跡のフード';
      expect(matches('フード', hood)).toBe(true);
      expect(matches('ふうど', hood)).toBe(true);
      expect(matches('ふーど', hood)).toBe(true);
      expect(matches('ふど', hood)).toBe(true);
      expect(matches('fudo', hood)).toBe(true);
      expect(matches('fuudo', hood)).toBe(true);
      expect(matches('fu-do', hood)).toBe(true);
    });

    it('collapses long vowels the same way on both sides', () => {
      expect(matches('raionhaato', 'ライオンハート')).toBe(true);
      expect(matches('raionhato', 'ライオンハート')).toBe(true);
      expect(matches('はと', 'ライオンハート')).toBe(true);
      expect(matches('しるど', 'ライオンハートシールド')).toBe(true);
      // おう and えい are long vowels too, not just the katakana mark.
      expect(matches('けぶき', 'はじまりのけいぶきのガラクタ')).toBe(true);
      expect(matches('keibuki', 'はじまりのけいぶきのガラクタ')).toBe(true);
      expect(matches('こえき', 'こうえきすいろ')).toBe(true);
    });

    it('does not collapse across a consonant or a moraic n', () => {
      // う here follows ん, which carries no vowel — it must survive.
      expect(matches('んう', 'んう')).toBe(true);
      expect(matches('あう', 'あう')).toBe(true);
    });

    it('does not convert romaji too short to be meant as kana', () => {
      // "no" -> の would otherwise appear in nearly every Japanese name.
      expect(matches('no', '夜の剣', 'よるのけん')).toBe(false);
      expect(matches('no', 'Bow of the Water Drop')).toBe(false);
    });

    it('keeps English findable while the UI is Japanese', () => {
      // 229 equipment have no translation and display their English name.
      expect(matches('silver axe', 'Silver Two-Handed Axe')).toBe(true);
      expect(matches('dagger', 'Frost Dagger')).toBe(true);
    });
  });
});

describe('normalize', () => {
  it('leaves the Latin alphabet alone', () => {
    expect(normalize('Silver Two-Handed Axe')).toBe('silver twohanded axe');
  });

  it('folds katakana to hiragana', () => {
    expect(normalize('ライオン')).toBe('らいおん');
  });

  it('leaves kanji untouched', () => {
    expect(normalize('鋼の重鎧')).toBe('鋼の重鎧');
  });

  it('handles mixed scripts per character rather than per string', () => {
    expect(normalize('Lv2 剣')).toBe('lv2 剣');
    expect(normalize('ル・ビッケン')).toBe('るびっけん');
  });

  it('collapses full-width characters', () => {
    expect(normalize('ＡＢＣ１')).toBe('abc1');
  });

  it('is idempotent, so re-normalizing a stored reading is harmless', () => {
    const once = normalize('ライオンハートシールド');
    expect(normalize(once)).toBe(once);
  });

  it('collapses every spelling of a long vowel to one form', () => {
    expect(normalize('フード')).toBe('ふど');
    expect(normalize('ふーど')).toBe('ふど');
    expect(normalize('ふうど')).toBe('ふど');
    // `きょ` is one mora over two characters — the small ょ carries the vowel,
    // so it survives and only the う lengthening it is dropped.
    expect(normalize('とうきょう')).toBe('ときょ');
    expect(normalize('せんせい')).toBe('せんせ');
  });
});
