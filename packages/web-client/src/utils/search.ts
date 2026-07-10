/**
 * Punctuation stripped before matching, so a typed term never has to reproduce
 * the exact punctuation of a name: "twohanded" and "two-handed" both find
 * "Two-Handed Axe", "goddesss" and "goddess's" both find "Goddess's Earrings".
 * Spaces survive, so a term still can't straddle two words.
 */
const IGNORED_PUNCTUATION = /[-'‘’‐-―]/g;

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

/** Lowercases and drops {@link IGNORED_PUNCTUATION}. */
function normalize(text: string): string {
  return text.toLowerCase().replace(IGNORED_PUNCTUATION, '');
}

/** Tests one piece of text against a compiled query. */
export type SearchMatcher = (text: string) => boolean;

/**
 * Compiles `query` into a predicate: every whitespace-separated term must appear
 * somewhere in the text, in any order — so "silver axe" and "axe silver" both
 * match "Silver Two-Handed Axe" — after both sides are normalized, and with each
 * term free to match any of its {@link TERM_ALIASES} instead ("2h axe" finds the
 * same item). Case- and punctuation-insensitive. An empty query matches everything.
 *
 * Compiled once per query rather than once per candidate, since the caller runs
 * it across a whole catalog on every keystroke.
 */
export function createSearchMatcher(query: string): SearchMatcher {
  const needleSets = normalize(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => [term, ...(TERM_ALIASES[term] ?? [])]);

  if (needleSets.length === 0) {
    return () => true;
  }
  return (text) => {
    const haystack = normalize(text);
    return needleSets.every((needles) => needles.some((needle) => haystack.includes(needle)));
  };
}
