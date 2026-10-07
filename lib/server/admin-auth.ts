import { auth } from '@/auth';

/**
 * Check if the current session user is an admin.
 *
 * Admin is the union of two tiers, resolved by enrichUserFields() in auth.ts
 * and surfaced as session.user.isAdmin:
 *
 *   - ADMIN_EMAILS membership (the founder tier), and
 *   - profiles.roles.admin, granted from /admin/users/live.
 *
 * Use this for ordinary admin gates — reading a queue, working the inbox,
 * exporting. It is the same source of truth the UI reads, so a screen and its
 * API can never disagree about who is allowed in.
 *
 * Returns the session user if admin, null otherwise.
 */
export async function checkAdminAuth() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return null;
  }
  return session.user;
}

/**
 * Check if the current session user may grant or revoke admin.
 *
 * This is the narrower, env-only tier: ADMIN_EMAILS membership, never the
 * column. Use it for anything that changes who is an admin, and nothing else.
 *
 * The split exists to bound the blast radius. If every admin could mint
 * admins, one compromised staff account would be self-replicating and
 * effectively permanent — revoking the original would not revoke what it had
 * already created, and there would be no tier left that the attacker could not
 * reach. Keeping the grant power on the env var means the recovery path lives
 * somewhere a web session cannot touch: changing it requires access to the
 * Cloudflare secret, not just a cookie.
 *
 * It also means a granted admin cannot quietly promote themselves to the tier
 * that would let them keep access after being revoked.
 *
 * Returns the session user if super admin, null otherwise.
 */
export async function checkSuperAdminAuth() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    return null;
  }
  return session.user;
}
