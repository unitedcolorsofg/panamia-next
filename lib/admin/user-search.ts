/**
 * Shared pieces of "find a pana to give a role to".
 *
 * Pure and dependency-free so the escaping below can be tested without a
 * database. The route in app/api/admin/users/search is the only caller.
 */

/**
 * Shortest query the search will run.
 *
 * One character matches most of the table, which is not a search result, it is
 * the table with extra steps — and it is the shape that makes an admin think
 * the filter is broken.
 */
export const MIN_SEARCH_LENGTH = 2;

/** Most rows returned. A grant needs one person, not a page of candidates. */
export const SEARCH_RESULT_LIMIT = 15;

/**
 * Escape the characters LIKE/ILIKE treats as wildcards.
 *
 * `%` and `_` are pattern syntax, not text. Interpolated raw, a search for
 * `%` becomes `%%%` and matches every account on the site, and a search for
 * `jose_` quietly matches `josex` too. Neither is a security hole — the value
 * is still bound as a parameter, so this is not an injection fix — but both
 * are wrong answers presented as right ones, on a page whose entire job is
 * identifying one specific human before handing them access.
 *
 * Backslash is escaped first and must stay first: doing it after would also
 * escape the backslashes this function just added, turning `%` into a literal
 * backslash followed by a live wildcard.
 *
 * Postgres reads backslash as the default LIKE escape character, so no
 * explicit ESCAPE clause is needed.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Trimmed query, or null when there is nothing worth querying for. */
export function normalizeSearchQuery(raw: string | null): string | null {
  const query = (raw ?? '').trim();
  return query.length >= MIN_SEARCH_LENGTH ? query : null;
}

/** The bound value for a contains-match on an escaped query. */
export function containsPattern(query: string): string {
  return `%${escapeLikePattern(query)}%`;
}
