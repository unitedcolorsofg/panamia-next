/**
 * Build the canonical path for a directory search term.
 *
 * The term is a single path segment, so it has to be encoded — slashes in a
 * term like "dj/producer" would otherwise split it into two segments, and a
 * bare space would end up in a malformed URL. An empty term falls back to the
 * bare /directory/search, which renders the browse view.
 *
 * Lives here rather than alongside the results page so entry points elsewhere
 * (the home hero, the header) can link to a search without importing that
 * page's component tree.
 */
export function searchPath(term: string): string {
  const trimmed = term.trim();
  return trimmed
    ? `/directory/search/${encodeURIComponent(trimmed)}`
    : '/directory/search';
}
