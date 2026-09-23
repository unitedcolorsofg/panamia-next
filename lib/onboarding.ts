/**
 * Shared vocabulary for the first-run experience, so the two places that nudge
 * a member toward a screenname agree with each other.
 *
 * Without this the pieces drift apart in a way the member feels directly: skip
 * the welcome page, navigate once, and the root-layout gate — not knowing an
 * answer was already given — would pop the same question again as a modal.
 *
 * See docs/ONBOARDING-ROADMAP.md.
 */

/**
 * Remembers, for the browser session, that this member has already declined to
 * pick a screenname. Keyed by user id rather than a bare flag so that signing
 * out and back in as someone else asks afresh instead of inheriting the
 * previous person's answer.
 *
 * The literal value predates the split into this module; it is preserved so
 * existing dismissals survive the refactor.
 */
export const ONBOARDING_DISMISS_KEY = 'pana:screenname-prompt-dismissed';

/**
 * How recently an account must have been created to be treated as arriving for
 * the first time.
 *
 * The distinction matters because the two cases deserve different handling. An
 * account minutes old belongs on the welcome page: it has never been asked
 * anything, and an interstitial is the gentlest place to ask. An account that
 * has existed for months without a screenname has already been asked and moved
 * on — interrupting that person's navigation with a full-page redirect would
 * be a hijack, so they keep the modal they can wave away.
 *
 * Ten minutes is generous for "just signed up" while staying far short of a
 * returning visit.
 */
export const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

export function isNewAccount(
  createdAt: string | Date | null | undefined,
  now: number = Date.now()
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  // A createdAt in the future means clock skew, not a new account; treating it
  // as new would redirect the member on every load.
  return created <= now && now - created < NEW_ACCOUNT_WINDOW_MS;
}
