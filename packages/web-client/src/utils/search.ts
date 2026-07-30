import { isRomaji, toHiragana } from 'wanakana';

/**
 * Punctuation stripped before matching, so a typed term never has to reproduce
 * the exact punctuation of a name: "twohanded" and "two-handed" both find
 * "Two-Handed Axe", "goddesss" and "goddess's" both find "Goddess's Earrings".
 * Spaces survive, so a term still can't straddle two words.
 *
 * The nakaguro (U+30FB) is here because it separates the parts of a
 * transliterated name (`ル・ビッケン`) that a player types as one run. The chōonpu
 * (U+30FC) is *not* — it spells a long vowel rather than punctuating, and is
 * handled by {@link collapseLongVowels}.
 *
 * Every non-ASCII member is written as an escape rather than a glyph. Most are
 * ASCII-confusable (an editor flags U+2018 against a backtick, U+2015 against a
 * hyphen) and several are near-identical to each other at normal font sizes —
 * exactly the kind of thing to get wrong silently inside a character class. In
 * source order:
 *
 * - `-` `'`          hyphen-minus, apostrophe
 * - U+2010–U+2015    the dash family: hyphen, non-breaking hyphen, figure dash,
 *                    en dash, em dash, horizontal bar
 * - U+2018, U+2019   curly single quotes
 * - U+30FB           nakaguro (katakana middle dot)
 */
const IGNORED_PUNCTUATION = /[-'\u2010-\u2015\u2018\u2019\u30FB]/g;

/** The chōonpu — katakana's "hold the previous vowel" mark. */
const PROLONGED_SOUND_MARK = 'ー';

/**
 * Hiragana grouped by the vowel they end in. Only hiragana, because
 * {@link normalize} folds katakana away before any of this runs.
 */
const KANA_BY_VOWEL: Readonly<Record<string, string>> = {
  a: 'あかさたなはまやらわがざだばぱぁゃゎ',
  i: 'いきしちにひみりゐぎじぢびぴぃ',
  u: 'うくすつぬふむゆるぐずづぶぷゔぅゅ',
  e: 'えけせてねへめれゑげぜでべぺぇ',
  o: 'おこそとのほもよろをごぞどぼぽぉょ',
};

/** Reverse of {@link KANA_BY_VOWEL}: which vowel a given kana ends in. */
const VOWEL_OF_KANA: ReadonlyMap<string, string> = new Map(
  Object.entries(KANA_BY_VOWEL).flatMap(
    ([vowel, kana]) => [...kana].map((char) => [char, vowel] as const),
  ),
);

/**
 * The kana that, written after a vowel, spell that same vowel long — `おう` is a
 * long "o" (とうきょう), `えい` a long "e" (せんせい), and so on.
 */
const LONG_VOWEL_CONTINUATIONS: Readonly<Record<string, string>> = {
  a: 'あ',
  i: 'い',
  u: 'う',
  e: 'えい',
  o: 'おう',
};

/**
 * Drops the length from long vowels, so every way of writing one collapses to
 * the same string: `ふうど`, `ふーど` and `フード` all become `ふど`.
 *
 * This is what makes long vowels searchable at all. The same sound has several
 * legitimate spellings — katakana holds it with `ー`, hiragana repeats the vowel
 * (`おう`, `えい`), and romaji is worse still (`fudo` / `fuudo` / `fu-do` / `fūdo`,
 * with macrons unavailable on most keyboards). A player picks one; the catalogue
 * uses another. Rather than enumerate the pairings, both sides drop the
 * distinction entirely.
 *
 * It over-collapses on purpose — `くうき` (air) and `くき` (stem) both become
 * `くき`. Since it runs on the query *and* the candidate, that only ever merges
 * two spellings into one match, never splits one apart: the cost is an occasional
 * extra result in a filter list, which is much cheaper than a name the player
 * cannot find.
 */
function collapseLongVowels(text: string): string {
  let collapsed = '';
  let previousVowel: string | undefined;

  for (const char of text) {
    const lengthensPreviousVowel = previousVowel !== undefined
      && (char === PROLONGED_SOUND_MARK || LONG_VOWEL_CONTINUATIONS[previousVowel]?.includes(char));
    if (lengthensPreviousVowel) {
      // Leave `previousVowel` alone, so a triple (`ふうう`) collapses too.
      continue;
    }
    collapsed += char;
    previousVowel = VOWEL_OF_KANA.get(char);
  }
  return collapsed;
}

/**
 * Shortest romaji term worth converting to kana. Below this the conversion is
 * more likely to be an English word fragment than an attempt at Japanese, and
 * short kana are catastrophically common: "no" would become `の`, which appears
 * in nearly every Japanese item name and would match the entire catalog.
 */
const MIN_ROMAJI_TERM_LENGTH = 3;

/**
 * Extra needles a typed term may stand for, keyed by the whole normalized term
 * (never a substring of one, so "1h" expands but "1hp" doesn't). A term matches
 * when the text contains it *or* any of its aliases, so an alias only ever
 * widens a search.
 *
 * Kept deliberately small — every entry is an abbreviation players actually type
 * ("2h"), a spelling variant ("armour"), a name the game itself shortens ("Heavy
 * Helm" is a helmet), or a name players reach for instead of the printed one
 * ("Lana", the adventurer, for her hard-to-spell Blade Cuisinart).
 */
const TERM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  '1h': ['onehanded'],
  '2h': ['twohanded'],
  armour: ['armor'],
  helmet: ['helm'],
  lana: ['cuisinart'],
};

/**
 * Folds text to the form both sides of a search are compared in: NFKC, lowercase,
 * {@link IGNORED_PUNCTUATION} dropped, and every kana folded to hiragana.
 *
 * Hiragana is the target rather than romaji because romaji is not a normal form —
 * `juu` and `jyuu` are the same word, and picking one as canonical loses whoever
 * typed the other. Converting *into* kana is many-to-one, so it converges.
 *
 * `passRomaji` is load-bearing: without it wanakana transliterates the Latin
 * alphabet too, and "Silver Two-Handed Axe" becomes `しlゔぇr とぉーはんでd あぇ`.
 * With it, kana fold and ASCII passes through — decided per character, which is
 * why one normalizer can serve both languages and why this beats an `isRomaji`
 * check on the whole string (`Lv2 剣` is neither wholly romaji nor wholly
 * Japanese, so a string-level test has no useful answer for it).
 *
 * NFKC is defensive rather than corrective: today's scraped names contain no
 * full-width ASCII or half-width katakana, but pasted input and future scrapes
 * can, and it costs one call.
 *
 * Kanji is left exactly as-is — no library can read it without a dictionary. That
 * gap is closed by matching against a stored reading as well; see
 * {@link createSearchMatcher}.
 */
export function normalize(text: string): string {
  const folded = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(IGNORED_PUNCTUATION, '');
  return collapseLongVowels(toHiragana(folded, { passRomaji: true }));
}

/**
 * The kana a romaji term may stand for, as an extra needle — so "raion" finds
 * `ライオン`. Empty for anything that isn't plausibly romaji, which leaves the
 * term to match on its own.
 *
 * Additive by design: the typed term is always kept alongside whatever this
 * returns. That matters in Japanese, where 229 equipment have no translation yet
 * and still display their English name — a player must be able to find those by
 * typing English even with the UI in Japanese.
 */
function kanaAliasesOf(term: string): string[] {
  if (term.length < MIN_ROMAJI_TERM_LENGTH || !isRomaji(term)) {
    return [];
  }
  // Back through `normalize` so the alias lands in exactly the same shape as the
  // haystack — long vowels collapsed included, which is what lets "fuudo" and
  // "fudo" both reach `フード`.
  const kana = normalize(toHiragana(term));
  return kana === term ? [] : [kana];
}

/** Tests pre-normalized text against a compiled query. */
export interface SearchMatcher {
  /**
   * True when every term in the query is found in at least one of `texts`.
   *
   * Each entry must already have been through {@link normalize} — the name says
   * so because getting it wrong fails silently, matching less rather than
   * throwing. Callers normalize once per item and reuse across keystrokes; see
   * `DataTable`.
   *
   * Terms may match *different* entries: a query can be satisfied by one word
   * from the display name and another from its reading.
   */
  matchesNormalized(texts: readonly string[]): boolean,
}

/**
 * Compiles `query` into a matcher: every whitespace-separated term must appear
 * somewhere in the candidate text, in any order — so "silver axe" and "axe
 * silver" both match "Silver Two-Handed Axe" — with each term free to match any
 * of its {@link TERM_ALIASES} or its romaji-to-kana reading instead ("2h axe"
 * and "raion" both work). Case-, punctuation- and script-insensitive. An empty
 * query matches everything.
 *
 * Compiled once per query rather than once per candidate, since the caller runs
 * it across a whole catalog on every keystroke.
 *
 * Japanese needs the array form of {@link SearchMatcher.matchesNormalized}: one
 * name is written in kanji, hiragana and katakana at once, so `よる` cannot reach
 * `夜` by folding strings — only by also searching the stored reading the seed
 * computed (`Equipment.nameJaReading`). Passing both the display name and that
 * reading means kanji matches the name directly and kana matches the reading,
 * and a wrong reading costs a miss rather than a wrong hit.
 */
export function createSearchMatcher(query: string): SearchMatcher {
  const needleSets = normalize(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => [
      term,
      ...(TERM_ALIASES[term] ?? []),
      ...kanaAliasesOf(term)]
    );

  if (needleSets.length === 0) {
    return { matchesNormalized: () => true };
  }
  return {
    matchesNormalized: (texts) => needleSets.every(
      (needles) => needles.some(
        (needle) => texts.some((text) => text.includes(needle)),
      ),
    ),
  };
}
