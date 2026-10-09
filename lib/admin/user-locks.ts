/**
 * The rules about lock reasons, with no dependencies.
 *
 * Separate from `lib/admin/users.ts` for the same reason `user-search.ts` is
 * separate from the search route: the table that renders the reason box is a
 * client component, and importing the minimum length from the module that
 * also imports `db` would pull Drizzle and a database connection into the
 * browser bundle. A sibling of that file, and deliberately as boring.
 *
 * Keeping the bound in one place is what stops the form and the API
 * disagreeing — a client that allows eight characters over a server that
 * demands ten produces a button that fails with no explanation.
 */

/**
 * Shortest reason accepted.
 *
 * Ten characters is not a quality bar, it is a floor under "x" and "spam".
 * The point of the minimum is that the field cannot be dismissed with a
 * keystroke; what makes a reason good is that it says what happened, and no
 * length check can enforce that.
 */
export const REASON_MIN = 10;

/** Long enough for an account of what happened; short enough to stay readable. */
export const REASON_MAX = 500;

export type ReasonProblem = 'too-short' | 'too-long' | null;

/** Validate a reason. Returns null when it passes. */
export function checkReason(reason: string): ReasonProblem {
  const trimmed = reason.trim();
  if (trimmed.length < REASON_MIN) return 'too-short';
  if (trimmed.length > REASON_MAX) return 'too-long';
  return null;
}

export function reasonError(problem: Exclude<ReasonProblem, null>): string {
  return problem === 'too-short'
    ? `Give a reason of at least ${REASON_MIN} characters.`
    : `Keep the reason under ${REASON_MAX} characters.`;
}
