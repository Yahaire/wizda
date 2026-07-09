/**
 * Splits `query` into whitespace-separated terms and checks that every term
 * appears somewhere in `text`, in any order — so "silver axe" and "axe
 * silver" both match "Silver Two-Handed Axe". Case-insensitive.
 */
export function matchesAllTerms(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}
